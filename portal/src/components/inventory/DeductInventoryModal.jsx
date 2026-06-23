import { useState, useEffect } from 'react'
import { getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { inventoryCol } from '../../firebase/firestore'
import { db } from '../../firebase/config'
import { writeTx } from '../../utils/inventoryTransactions'

const CATALOG_CATEGORY = { Drone: 'Drone Kit', Part: 'Parts', Accessory: 'Accessory', Service: 'Other', Other: 'Other' }

/** Match inventory to a line item by SKU only — catalog is the sole authority. */
function autoMatchId(inventory, li) {
  const liSku = (li.sku ?? '').trim().toLowerCase()
  if (!liSku) return ''
  const match = inventory
    .filter((inv) => (inv.sku ?? '').trim().toLowerCase() === liSku)
    .sort((a, b) => (b.quantityOnHand ?? 0) - (a.quantityOnHand ?? 0))[0]
  return match?.id ?? ''
}

export default function DeductInventoryModal({ lineItems, dealerId, title, alreadyDeducted, source, onClose, onDone, catalogMap = {} }) {
  // Catalog items (have sku, type === 'catalog') → tracked in inventory
  // Custom items (type === 'custom' or no sku) → not deducted
  const catalogItems = lineItems.filter((li) => li.type === 'catalog' && li.sku?.trim())
  const customItems = lineItems.filter((li) => li.type !== 'catalog' || !li.sku?.trim())

  const [inventory, setInventory] = useState([])
  const [loadingInv, setLoadingInv] = useState(true)
  const [rows, setRows] = useState(() =>
    catalogItems.map((li) => ({ lineItem: li, source: 'warehouse', inventoryId: '' }))
  )
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getDocs(inventoryCol).then((snap) => {
      const inv = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setInventory(inv)
      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          inventoryId: autoMatchId(inv, row.lineItem),
        }))
      )
      setLoadingInv(false)
    })
  }, [dealerId])

  function setRowField(id, field, value) {
    setRows((prev) => prev.map((r) => r.lineItem.id === id ? { ...r, [field]: value } : r))
  }

  function matchAll() {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        source: 'warehouse',
        inventoryId: autoMatchId(inventory, row.lineItem),
      }))
    )
  }

  function allOem() {
    setRows((prev) => prev.map((r) => ({ ...r, source: 'oem', inventoryId: '' })))
  }

  function allWarehouse() {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        source: 'warehouse',
        inventoryId: r.inventoryId || autoMatchId(inventory, r.lineItem),
      }))
    )
  }

  async function handleConfirm() {
    setError('')
    const warehouseRows = rows.filter((r) => r.source === 'warehouse')
    if (warehouseRows.length === 0 && catalogItems.length > 0) { onDone([]); return }
    if (catalogItems.length === 0) { onDone([]); return }

    setRunning(true)
    try {
      const details = []
      const txEntries = []

      for (const row of warehouseRows) {
        const qty = row.lineItem.quantity ?? 1
        const liSku = (row.lineItem.sku ?? '').trim()
        const catItem = row.lineItem.catalogId ? (catalogMap[row.lineItem.catalogId] ?? null) : null
        const resolvedSku = catItem?.sku?.trim() || liSku
        const resolvedBrand = catItem?.manufacturer?.trim() || null
        const resolvedCategory = catItem ? (CATALOG_CATEGORY[catItem.type] ?? null) : null
        const resolvedModelName = catItem?.name?.trim() || row.lineItem.description

        if (!row.inventoryId) {
          // No inventory record matched — create a shortfall (requires SKU, already filtered above)
          const negRef = await addDoc(inventoryCol, {
            dealerId: dealerId || null,
            catalogId: row.lineItem.catalogId ?? null,
            modelName: resolvedModelName,
            sku: resolvedSku || null,
            brand: resolvedBrand,
            category: resolvedCategory,
            condition: 'New',
            quantityOnHand: -qty,
            quantityReserved: 0,
            quantityAvailable: -qty,
            notes: 'Auto-created: inventory shortfall',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
          details.push({ type: 'shortfall', inventoryId: negRef.id, model: resolvedModelName, sku: resolvedSku ?? '', qty: -qty })
          txEntries.push({
            type: 'deduction', qty: -qty,
            modelName: resolvedModelName,
            brand: resolvedBrand, sku: resolvedSku, category: resolvedCategory, dealerId,
            inventoryId: negRef.id,
            sourceType: source?.type ?? null, sourceId: source?.id ?? null, sourceNumber: source?.number ?? null,
            notes: 'Shortfall — negative inventory created',
            createdBy: source?.createdBy ?? '',
          })
        } else {
          const inv = inventory.find((i) => i.id === row.inventoryId)
          const newOnHand = (inv?.quantityOnHand ?? 0) - qty
          await updateDoc(doc(db, 'inventory', row.inventoryId), {
            quantityOnHand: newOnHand,
            quantityAvailable: Math.max(0, newOnHand - (inv?.quantityReserved ?? 0)),
            updatedAt: serverTimestamp(),
          })
          details.push({
            type: 'deducted', inventoryId: row.inventoryId,
            model: inv?.modelName || resolvedModelName,
            sku: inv?.sku || resolvedSku || '', qty,
          })
          txEntries.push({
            type: 'deduction', qty: -qty,
            modelName: inv?.modelName || resolvedModelName,
            brand: inv?.brand ?? resolvedBrand ?? null,
            sku: inv?.sku ?? resolvedSku ?? null,
            category: inv?.category ?? resolvedCategory ?? null,
            dealerId: inv?.dealerId ?? dealerId,
            inventoryId: row.inventoryId,
            sourceType: source?.type ?? null, sourceId: source?.id ?? null, sourceNumber: source?.number ?? null,
            createdBy: source?.createdBy ?? '',
          })
        }
      }

      if (txEntries.length > 0) await writeTx(txEntries)
      setResult({ details, hadShortfall: details.some((d) => d.type === 'shortfall') })
    } catch (e) {
      console.error('Deduction error:', e)
      setError(`Failed: ${e?.message ?? 'Unknown error'}`)
      setRunning(false)
    }
  }

  const warehouseCount = rows.filter((r) => r.source === 'warehouse').length

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#1A1A1A]">{title}</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!result ? (
            <>
              {alreadyDeducted && (
                <div className="bg-[#E6A817]/10 border border-[#E6A817]/30 rounded-lg px-4 py-3 text-sm text-[#E6A817] font-medium">
                  ⚠ Previously deducted — re-running will deduct again. Only proceed if the first run was incorrect.
                </div>
              )}

              {/* Custom / untracked items */}
              {customItems.length > 0 && (
                <div className="bg-[#F4F4F5] border border-gray-200 rounded-lg px-4 py-3 text-sm">
                  <p className="font-medium text-[#9A9A9A] mb-1 text-xs uppercase tracking-wider">Not tracked in inventory</p>
                  {customItems.map((li) => (
                    <p key={li.id} className="text-xs text-[#9A9A9A] mt-0.5">
                      · {li.description} — custom line item, no inventory deduction
                    </p>
                  ))}
                </div>
              )}

              {catalogItems.length === 0 ? (
                <p className="text-sm text-[#9A9A9A] text-center py-6">
                  No catalog items to deduct — all line items are custom.
                </p>
              ) : (
                <>
                  {/* Quick actions */}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={matchAll} disabled={loadingInv}
                      className="text-xs border border-[#8B6914] text-[#8B6914] hover:bg-[#8B6914]/5 px-3 py-1.5 rounded-lg font-medium disabled:opacity-40">
                      Auto-match All
                    </button>
                    <button onClick={allWarehouse}
                      className="text-xs border border-gray-200 text-[#1A1A1A] hover:bg-[#F4F4F5] px-3 py-1.5 rounded-lg">
                      All From Warehouse
                    </button>
                    <button onClick={allOem}
                      className="text-xs border border-gray-200 text-[#9A9A9A] hover:bg-[#F4F4F5] px-3 py-1.5 rounded-lg">
                      All OEM Direct
                    </button>
                  </div>

                  {loadingInv ? (
                    <p className="text-sm text-[#9A9A9A] text-center py-6 animate-pulse">Loading inventory…</p>
                  ) : (
                    <div className="space-y-3">
                      {rows.map((row) => {
                        const qty = row.lineItem.quantity ?? 1
                        const liSkuNorm = (row.lineItem.sku ?? '').trim().toLowerCase()
                        // Only show inventory records matching this item's SKU
                        const skuInventory = inventory.filter((inv) =>
                          liSkuNorm && (inv.sku ?? '').trim().toLowerCase() === liSkuNorm
                        )
                        const selInv = row.inventoryId ? inventory.find((i) => i.id === row.inventoryId) : null
                        const wouldGoNeg = selInv && row.source === 'warehouse' && (selInv.quantityOnHand ?? 0) < qty
                        return (
                          <div key={row.lineItem.id} className={`border rounded-lg p-3 space-y-2 ${wouldGoNeg ? 'border-[#D95F5F]/40 bg-[#D95F5F]/5' : 'border-gray-200'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[#1A1A1A] truncate">{row.lineItem.description}</p>
                                <p className="text-xs text-[#9A9A9A]">
                                  Qty: {qty}
                                  {row.lineItem.sku && <span className="ml-2 font-mono">· SKU: {row.lineItem.sku}</span>}
                                </p>
                              </div>
                              <div className="flex rounded-lg border border-gray-200 overflow-hidden shrink-0">
                                <button
                                  onClick={() => setRowField(row.lineItem.id, 'source', 'warehouse')}
                                  className={`text-xs px-2.5 py-1 font-medium transition-colors ${row.source === 'warehouse' ? 'bg-[#8B6914] text-white' : 'text-[#9A9A9A] hover:bg-[#F4F4F5]'}`}>
                                  Warehouse
                                </button>
                                <button
                                  onClick={() => { setRowField(row.lineItem.id, 'source', 'oem'); setRowField(row.lineItem.id, 'inventoryId', '') }}
                                  className={`text-xs px-2.5 py-1 font-medium transition-colors border-l border-gray-200 ${row.source === 'oem' ? 'bg-[#4A90B8] text-white' : 'text-[#9A9A9A] hover:bg-[#F4F4F5]'}`}>
                                  OEM Direct
                                </button>
                              </div>
                            </div>

                            {row.source === 'warehouse' && (
                              <div className="space-y-1">
                                <select
                                  value={row.inventoryId}
                                  onChange={(e) => setRowField(row.lineItem.id, 'inventoryId', e.target.value)}
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#8B6914] bg-white">
                                  <option value="">— No inventory match (will create shortfall) —</option>
                                  {skuInventory
                                    .slice()
                                    .sort((a, b) => {
                                      const ap = a.dealerId === dealerId ? 1 : 0
                                      const bp = b.dealerId === dealerId ? 1 : 0
                                      return bp - ap || (b.quantityOnHand ?? 0) - (a.quantityOnHand ?? 0)
                                    })
                                    .map((inv) => (
                                      <option key={inv.id} value={inv.id}>
                                        {inv.modelName || inv.sku}
                                        {` · On Hand: ${inv.quantityOnHand ?? 0}`}
                                        {inv.condition ? ` · ${inv.condition}` : ''}
                                        {inv.dealerId === dealerId ? ' ★' : ''}
                                      </option>
                                    ))}
                                </select>
                                {skuInventory.length === 0 && (
                                  <p className="text-xs text-[#E6A817] font-medium">
                                    No inventory found for SKU {row.lineItem.sku} — a shortfall entry will be created
                                  </p>
                                )}
                                {wouldGoNeg && (
                                  <p className="text-xs text-[#D95F5F] font-medium">
                                    ⚠ Only {selInv.quantityOnHand ?? 0} on hand — deducting {qty} will create negative stock
                                  </p>
                                )}
                                {row.inventoryId && !wouldGoNeg && (
                                  <p className="text-xs text-[#4CAF7D]">
                                    Matched by SKU · {selInv?.quantityOnHand ?? 0} on hand
                                  </p>
                                )}
                              </div>
                            )}
                            {row.source === 'oem' && (
                              <p className="text-xs text-[#4A90B8]">Ships directly from manufacturer — no inventory deduction</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
              {error && <p className="text-sm text-[#D95F5F] font-medium">{error}</p>}
            </>
          ) : (
            <>
              <div className={`rounded-lg px-4 py-3 text-sm font-medium ${result.hadShortfall ? 'bg-[#E6A817]/10 border border-[#E6A817]/30 text-[#E6A817]' : 'bg-[#4CAF7D]/10 border border-[#4CAF7D]/30 text-[#4CAF7D]'}`}>
                {result.hadShortfall
                  ? 'Deduction complete — some items had insufficient stock. Negative entries were created.'
                  : 'Inventory deducted successfully.'}
              </div>
              <div className="space-y-2">
                {result.details.map((d, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm border ${d.type === 'shortfall' ? 'bg-[#D95F5F]/5 border-[#D95F5F]/20' : 'bg-[#4CAF7D]/5 border-[#4CAF7D]/20'}`}>
                    <div>
                      <p className="font-medium text-[#1A1A1A]">{d.model}</p>
                      {d.sku && <p className="text-xs text-[#9A9A9A] font-mono">SKU: {d.sku}</p>}
                    </div>
                    <span className={`font-semibold shrink-0 ${d.type === 'shortfall' ? 'text-[#D95F5F]' : 'text-[#4CAF7D]'}`}>
                      {d.type === 'shortfall' ? `${d.qty} (negative entry)` : `−${d.qty} deducted`}
                    </span>
                  </div>
                ))}
                {result.details.length === 0 && (
                  <p className="text-sm text-[#9A9A9A] text-center py-2">All items marked OEM Direct — no inventory deducted.</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          {!result ? (
            <>
              <button onClick={onClose} disabled={running}
                className="flex-1 border border-gray-200 text-[#1A1A1A] text-sm font-medium py-2 rounded-lg hover:bg-[#F4F4F5] disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={running || loadingInv || catalogItems.length === 0}
                className="flex-1 bg-[#8B6914] text-white text-sm font-semibold py-2 rounded-lg hover:bg-[#7a5c11] disabled:opacity-50 transition-colors">
                {catalogItems.length === 0
                  ? 'No catalog items to deduct'
                  : running ? 'Deducting…'
                  : `Deduct${warehouseCount > 0 ? ` (${warehouseCount} from warehouse)` : ''}`}
              </button>
            </>
          ) : (
            <button onClick={() => onDone(result.details)}
              className="flex-1 bg-[#8B6914] text-white text-sm font-semibold py-2 rounded-lg hover:bg-[#7a5c11] transition-colors">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
