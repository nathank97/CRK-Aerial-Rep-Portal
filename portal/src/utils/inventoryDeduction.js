import { getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { inventoryCol } from '../firebase/firestore'
import { db } from '../firebase/config'
import { writeTx } from './inventoryTransactions'

/**
 * Auto-deduct inventory for a list of line items.
 * source: { type: 'order'|'invoice', id, number, createdBy }
 * Returns { details, hadShortfall }
 */
export async function autoDeductInventory(lineItems, dealerId, source = {}) {
  const invSnap = await getDocs(inventoryCol)
  const inventory = invSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    _work: d.data().quantityOnHand ?? 0,
  }))

  // Group by catalogId (best), then SKU, then normalized description
  const groups = new Map()
  for (const li of lineItems) {
    const liSku = li.sku?.trim().toLowerCase() || ''
    const key = li.catalogId || (liSku ? `sku:${liSku}` : li.description?.toLowerCase().trim()) || li.id
    if (!groups.has(key)) {
      groups.set(key, { catalogId: li.catalogId || null, description: li.description || '', sku: li.sku?.trim() || '', totalQty: 0 })
    }
    groups.get(key).totalQty += (li.quantity ?? 1)
  }

  const details = []
  const txEntries = []

  for (const [, group] of groups) {
    let remaining = group.totalQty

    const groupSku = group.sku.toLowerCase()
    const matches = inventory
      .filter((inv) => {
        if (inv._work <= 0) return false
        if (group.catalogId && inv.catalogId === group.catalogId) return true
        const invSku = (inv.sku ?? '').toLowerCase().trim()
        if (groupSku && invSku && groupSku === invSku) return true  // SKU-to-SKU (primary)
        const m = (inv.modelName ?? '').toLowerCase().trim()
        const d = group.description.toLowerCase().trim()
        if (!d) return false
        return (invSku && invSku === d) || (m && (m === d || m.includes(d) || d.includes(m)))
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

      details.push({ type: 'deducted', inventoryId: inv.id, model: inv.modelName || group.description, sku: inv.sku || '', qty: toDeduct })
      txEntries.push({
        type: 'deduction',
        qty: -toDeduct,
        modelName: inv.modelName || group.description,
        brand: inv.brand ?? null,
        sku: inv.sku ?? null,
        category: inv.category ?? null,
        dealerId: inv.dealerId ?? dealerId,
        inventoryId: inv.id,
        sourceType: source.type ?? null,
        sourceId: source.id ?? null,
        sourceNumber: source.number ?? null,
        createdBy: source.createdBy ?? '',
      })
    }

    if (remaining > 0) {
      const shortfallSku = group.sku || null
      const negRef = await addDoc(inventoryCol, {
        dealerId: dealerId || null,
        catalogId: group.catalogId || null,
        modelName: group.description,
        sku: shortfallSku, brand: null, category: null, condition: 'New',
        quantityOnHand: -remaining, quantityReserved: 0, quantityAvailable: -remaining,
        notes: 'Auto-created: inventory shortfall',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      details.push({ type: 'shortfall', inventoryId: negRef.id, model: group.description, sku: shortfallSku ?? '', qty: -remaining })
      txEntries.push({
        type: 'deduction',
        qty: -remaining,
        modelName: group.description,
        brand: null, sku: shortfallSku, category: null,
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
        notes: `Reversed deduction`,
        createdBy: source.createdBy ?? '',
      })
    } else if (detail.type === 'shortfall') {
      // Delete the negative inventory record that was auto-created
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
