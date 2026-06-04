import { getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { inventoryCol } from '../firebase/firestore'
import { db } from '../firebase/config'

/**
 * Auto-deduct inventory for a list of line items.
 * - Groups items by catalogId (best) or normalized description
 * - Deducts from matching inventory records (dealer's location first, then any)
 * - Creates ONE negative inventory record per unique item where stock is insufficient
 * Returns { details, hadShortfall }
 */
export async function autoDeductInventory(lineItems, dealerId) {
  const invSnap = await getDocs(inventoryCol)
  const inventory = invSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    _work: d.data().quantityOnHand ?? 0, // working copy to prevent double-deducting in one pass
  }))

  // Group line items: catalogId takes priority, then normalized description
  const groups = new Map()
  for (const li of lineItems) {
    const key = li.catalogId || li.description?.toLowerCase().trim() || li.id
    if (!groups.has(key)) {
      groups.set(key, { catalogId: li.catalogId || null, description: li.description || '', totalQty: 0 })
    }
    groups.get(key).totalQty += (li.quantity ?? 1)
  }

  const details = []

  for (const [, group] of groups) {
    let remaining = group.totalQty

    // Find matching inventory — prefer same dealer, prefer higher stock
    const matches = inventory
      .filter((inv) => {
        if (inv._work <= 0) return false
        if (group.catalogId && inv.catalogId === group.catalogId) return true
        const s = (inv.sku ?? '').toLowerCase().trim()
        const m = (inv.modelName ?? '').toLowerCase().trim()
        const d = group.description.toLowerCase().trim()
        if (!d) return false
        return (s && s === d) || (m && (m === d || m.includes(d) || d.includes(m)))
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

      details.push({
        type: 'deducted',
        inventoryId: inv.id,
        model: inv.modelName || inv.sku || group.description,
        sku: inv.sku || '',
        qty: toDeduct,
      })
    }

    // Create a single negative record for whatever couldn't be covered
    if (remaining > 0) {
      const negRef = await addDoc(inventoryCol, {
        dealerId: dealerId || null,
        modelName: group.description,
        sku: null,
        brand: null,
        category: null,
        condition: 'New',
        quantityOnHand: -remaining,
        quantityReserved: 0,
        quantityAvailable: -remaining,
        notes: 'Auto-created: inventory shortfall',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      details.push({
        type: 'shortfall',
        inventoryId: negRef.id,
        model: group.description,
        sku: '',
        qty: -remaining,
      })
    }
  }

  return { details, hadShortfall: details.some((d) => d.type === 'shortfall') }
}
