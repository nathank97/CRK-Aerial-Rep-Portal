import { getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { inventoryCol } from '../firebase/firestore'
import { db } from '../firebase/config'
import { writeTx } from './inventoryTransactions'

const CATALOG_CATEGORY = { Drone: 'Drone Kit', Part: 'Parts', Accessory: 'Accessory', Service: 'Other', Other: 'Other' }

/**
 * Auto-deduct inventory for a list of line items.
 * Only catalog items (type === 'catalog' with a sku) are processed.
 * Matching is by SKU only — catalog is the single source of truth.
 * catalogMap: { [catalogId]: catalogItem } for metadata resolution.
 * source: { type: 'order'|'invoice', id, number, createdBy }
 */
export async function autoDeductInventory(lineItems, dealerId, source = {}, catalogMap = {}) {
  const invSnap = await getDocs(inventoryCol)
  const inventory = invSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    _work: d.data().quantityOnHand ?? 0,
  }))

  // Only process catalog line items that have a SKU — custom items are never deducted
  const catalogLineItems = lineItems.filter((li) => li.type === 'catalog' && li.sku?.trim())

  // Group by normalized SKU
  const groups = new Map()
  for (const li of catalogLineItems) {
    const skuKey = li.sku.trim().toLowerCase()
    if (!groups.has(skuKey)) {
      const catItem = li.catalogId ? (catalogMap[li.catalogId] ?? null) : null
      groups.set(skuKey, {
        sku: li.sku.trim(),
        catalogId: li.catalogId || null,
        modelName: catItem?.name?.trim() || li.description || '',
        brand: catItem?.manufacturer?.trim() || null,
        category: catItem ? (CATALOG_CATEGORY[catItem.type] ?? null) : null,
        totalQty: 0,
      })
    }
    groups.get(skuKey).totalQty += (li.quantity ?? 1)
  }

  const details = []
  const txEntries = []

  for (const [skuKey, group] of groups) {
    let remaining = group.totalQty

    // Match inventory by SKU only — no name matching, no catalogId matching
    const matches = inventory
      .filter((inv) => {
        if (inv._work <= 0) return false
        return (inv.sku ?? '').trim().toLowerCase() === skuKey
      })
      .sort((a, b) => {
        const ap = a.dealerId === dealerId ? 1 : 0
        const bp = b.dealerId === dealerId ? 1 : 0
        return bp - ap || b._work - a._work
      })

    for (const inv of matches) {
      if (remaining <= 0) break
      const toDeduct = Math.min(inv._work, remaining)
      const newOnHand = inv._work - toDeduct
      await updateDoc(doc(db, 'inventory', inv.id), {
        quantityOnHand: newOnHand,
        quantityAvailable: Math.max(0, newOnHand - (inv.quantityReserved ?? 0)),
        updatedAt: serverTimestamp(),
      })
      inv._work = newOnHand
      remaining -= toDeduct

      details.push({ type: 'deducted', inventoryId: inv.id, model: inv.modelName || group.modelName, sku: inv.sku || '', qty: toDeduct })
      txEntries.push({
        type: 'deduction',
        qty: -toDeduct,
        modelName: inv.modelName || group.modelName,
        brand: inv.brand ?? group.brand ?? null,
        sku: inv.sku ?? group.sku ?? null,
        category: inv.category ?? group.category ?? null,
        dealerId: inv.dealerId ?? dealerId,
        inventoryId: inv.id,
        sourceType: source.type ?? null,
        sourceId: source.id ?? null,
        sourceNumber: source.number ?? null,
        createdBy: source.createdBy ?? '',
      })
    }

    if (remaining > 0) {
      // Shortfall — create negative inventory record with full catalog metadata
      const negRef = await addDoc(inventoryCol, {
        dealerId: dealerId || null,
        catalogId: group.catalogId || null,
        modelName: group.modelName,
        sku: group.sku,
        brand: group.brand,
        category: group.category,
        condition: 'New',
        quantityOnHand: -remaining,
        quantityReserved: 0,
        quantityAvailable: -remaining,
        notes: 'Auto-created: inventory shortfall',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      details.push({ type: 'shortfall', inventoryId: negRef.id, model: group.modelName, sku: group.sku ?? '', qty: -remaining })
      txEntries.push({
        type: 'deduction',
        qty: -remaining,
        modelName: group.modelName,
        brand: group.brand,
        sku: group.sku,
        category: group.category,
        dealerId,
        inventoryId: negRef.id,
        sourceType: source.type ?? null,
        sourceId: source.id ?? null,
        sourceNumber: source.number ?? null,
        notes: 'Shortfall — negative inventory created',
        createdBy: source.createdBy ?? '',
      })
    }
  }

  if (txEntries.length > 0) await writeTx(txEntries)

  return { details, hadShortfall: details.some((d) => d.type === 'shortfall') }
}

/**
 * Reverse a previous deduction.
 * deductionDetails: the inventoryDeductionDetails array stored on the order/invoice
 * source: { type, id, number, createdBy }
 */
export async function undoInventoryDeduction(deductionDetails, dealerId, source = {}) {
  const txEntries = []

  for (const detail of (deductionDetails ?? [])) {
    if (!detail.inventoryId) continue

    if (detail.type === 'deducted') {
      const invSnap = await getDoc(doc(db, 'inventory', detail.inventoryId))
      if (!invSnap.exists()) continue
      const data = invSnap.data()
      const newOnHand = (data.quantityOnHand ?? 0) + detail.qty
      await updateDoc(doc(db, 'inventory', detail.inventoryId), {
        quantityOnHand: newOnHand,
        quantityAvailable: Math.max(0, newOnHand - (data.quantityReserved ?? 0)),
        updatedAt: serverTimestamp(),
      })
      txEntries.push({
        type: 'reversal',
        qty: detail.qty,
        modelName: data.modelName || detail.model,
        brand: data.brand ?? null,
        sku: data.sku ?? detail.sku ?? null,
        category: data.category ?? null,
        dealerId: data.dealerId ?? dealerId,
        inventoryId: detail.inventoryId,
        sourceType: source.type ?? null,
        sourceId: source.id ?? null,
        sourceNumber: source.number ?? null,
        notes: 'Reversed deduction',
        createdBy: source.createdBy ?? '',
      })
    } else if (detail.type === 'shortfall') {
      try { await deleteDoc(doc(db, 'inventory', detail.inventoryId)) } catch {}
      txEntries.push({
        type: 'reversal',
        qty: Math.abs(detail.qty),
        modelName: detail.model,
        brand: null,
        sku: detail.sku ?? null,
        category: null,
        dealerId,
        inventoryId: null,
        sourceType: source.type ?? null,
        sourceId: source.id ?? null,
        sourceNumber: source.number ?? null,
        notes: 'Shortfall record deleted',
        createdBy: source.createdBy ?? '',
      })
    }
  }

  if (txEntries.length > 0) await writeTx(txEntries)
}
