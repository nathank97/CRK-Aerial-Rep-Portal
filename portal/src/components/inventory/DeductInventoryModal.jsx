import { useState } from 'react'
import { autoDeductInventory } from '../../utils/inventoryDeduction'
import { formatCurrency } from '../../utils/formatters'

/**
 * Shared modal for confirming inventory deduction before it runs.
 * Props:
 *   lineItems  — array of order/invoice line items
 *   dealerId   — location to deduct from first
 *   title      — modal title string
 *   onClose()  — called on cancel or after completion
 *   onDone(details) — called after successful deduction
 */
export default function DeductInventoryModal({ lineItems, dealerId, title, alreadyDeducted, onClose, onDone }) {
  const [oemFlags, setOemFlags] = useState(() => {
    const flags = {}
    lineItems.forEach((li) => { flags[li.id] = false })
    return flags
  })
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const toggleOem = (id) => setOemFlags((p) => ({ ...p, [id]: !p[id] }))

  const activeItems = lineItems.filter((li) => !oemFlags[li.id])

  async function handleConfirm() {
    if (activeItems.length === 0) {
      // All marked OEM Direct — nothing to deduct
      onDone([])
      return
    }
    setRunning(true)
    setError('')
    try {
      const { details, hadShortfall } = await autoDeductInventory(activeItems, dealerId)
      setResult({ details, hadShortfall })
    } catch (e) {
      console.error('Deduction error:', e)
      setError(`Failed to deduct: ${e?.message ?? 'Unknown error'}`)
      setRunning(false)
    }
  }

  function handleDone() {
    onDone(result?.details ?? [])
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#1A1A1A]">{title}</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!result ? (
            <>
              {alreadyDeducted && (
                <div className="mb-4 bg-[#E6A817]/10 border border-[#E6A817]/30 rounded-lg px-4 py-3 text-sm text-[#E6A817] font-medium">
                  ⚠ Inventory was previously deducted for this order. Re-running will deduct <strong>again</strong> — only proceed if the previous run was incorrect (e.g. everything was marked OEM Direct by mistake).
                </div>
              )}
              <p className="text-sm text-[#9A9A9A] mb-4">
                Mark any line items that ship directly from the manufacturer (OEM Direct) — those will be skipped.
                Everything else will be deducted from inventory. Items with insufficient stock will create negative
                inventory entries so you know what to reorder.
              </p>
              <div className="space-y-2">
                {lineItems.map((li) => (
                  <label key={li.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      oemFlags[li.id] ? 'border-gray-200 bg-[#F4F4F5] opacity-60' : 'border-gray-200 hover:border-[#8B6914]/40'
                    }`}>
                    <input
                      type="checkbox"
                      checked={oemFlags[li.id]}
                      onChange={() => toggleOem(li.id)}
                      className="accent-[#8B6914] w-4 h-4 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${oemFlags[li.id] ? 'line-through text-[#9A9A9A]' : 'text-[#1A1A1A]'}`}>
                        {li.description}
                      </p>
                      <p className="text-xs text-[#9A9A9A]">
                        Qty: {li.quantity ?? 1}
                        {li.unitPrice ? ` · ${formatCurrency(li.unitPrice)} / unit` : ''}
                      </p>
                    </div>
                    <span className={`text-xs font-medium shrink-0 ${oemFlags[li.id] ? 'text-[#9A9A9A]' : 'text-[#8B6914]'}`}>
                      {oemFlags[li.id] ? 'OEM Direct' : 'From Warehouse'}
                    </span>
                  </label>
                ))}
              </div>
              {activeItems.length === 0 && (
                <p className="text-xs text-[#9A9A9A] text-center mt-3">
                  All items marked OEM Direct — no inventory will be deducted.
                </p>
              )}
              {error && <p className="mt-3 text-sm text-[#D95F5F]">{error}</p>}
            </>
          ) : (
            <>
              <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
                result.hadShortfall
                  ? 'bg-[#E6A817]/10 border border-[#E6A817]/30 text-[#E6A817]'
                  : 'bg-[#4CAF7D]/10 border border-[#4CAF7D]/30 text-[#4CAF7D]'
              }`}>
                {result.hadShortfall
                  ? 'Deduction complete — some items had insufficient stock. Negative entries were created in inventory.'
                  : 'Inventory deducted successfully.'}
              </div>
              <div className="space-y-2">
                {result.details.map((d, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                    d.type === 'shortfall' ? 'bg-[#D95F5F]/8 border border-[#D95F5F]/20' : 'bg-[#4CAF7D]/8 border border-[#4CAF7D]/20'
                  }`}>
                    <div>
                      <p className="font-medium text-[#1A1A1A]">{d.model}</p>
                      {d.sku && <p className="text-xs text-[#9A9A9A]">SKU: {d.sku}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {d.type === 'shortfall' ? (
                        <span className="font-semibold text-[#D95F5F]">{d.qty} (negative entry created)</span>
                      ) : (
                        <span className="font-semibold text-[#4CAF7D]">−{d.qty} deducted</span>
                      )}
                    </div>
                  </div>
                ))}
                {result.details.length === 0 && (
                  <p className="text-sm text-[#9A9A9A] text-center py-2">No inventory items matched — no deductions made.</p>
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
              <button onClick={handleConfirm} disabled={running}
                className="flex-1 bg-[#8B6914] text-white text-sm font-semibold py-2 rounded-lg hover:bg-[#7a5c11] disabled:opacity-50 transition-colors">
                {running ? 'Deducting…' : `Deduct Inventory (${activeItems.length} item${activeItems.length !== 1 ? 's' : ''})`}
              </button>
            </>
          ) : (
            <button onClick={handleDone}
              className="flex-1 bg-[#8B6914] text-white text-sm font-semibold py-2 rounded-lg hover:bg-[#7a5c11] transition-colors">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
