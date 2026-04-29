import { getDocs, getDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { inventoryCol } from '../firebase/firestore'

// Match order line items against inventory by SKU (exact) → model name (contains).
// Prefers items at the rep's own location (dealerId). Mutates a local copy so
// sequential line items don't double-book the same inventory record.
// Returns an array of result objects — one per line item.
export async function matchAndReserve(lineItems, dealerId) {
  const snap = await getDocs(inventoryCol)
  // Working copy — we mutate quantityReserved locally so later iterations
  // don't over-commit the same row.
  const inventory = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const results = []

  for (const li of lineItems) {
    const qty = li.quantity ?? 1
    const desc = (li.description ?? '').toLowerCase().trim()

    // Score: 3 = SKU exact, 2 = model exact, 1 = model contains description or vice versa
    const scored = inventory
      .map((inv) => {
        const sku = (inv.sku ?? '').toLowerCase().trim()
        const model = (inv.modelName ?? '').toLowerCase().trim()
        const score = sku && sku === desc ? 3
          : model && model === desc ? 2
          : (model && (model.includes(desc) || desc.includes(model))) ? 1
          : 0
        return { inv, score, preferred: inv.dealerId === dealerId ? 1 : 0 }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.preferred - a.preferred || b.score - a.score)

    if (scored.length > 0) {
      const { inv } = scored[0]
      const newReserved = (inv.quantityReserved ?? 0) + qty
      await updateDoc(doc(db, 'inventory', inv.id), {
        quantityReserved: newReserved,
        updatedAt: serverTimestamp(),
      })
      inv.quantityReserved = newReserved // update local copy
      results.push({
        inventoryId: inv.id,
        model: inv.modelName ?? '',
        sku: inv.sku ?? '',
        qty,
        description: li.description ?? '',
        matched: true,
      })
    } else {
      results.push({
        qty,
        description: li.description ?? '',
        matched: false,
      })
    }
  }

  return results
}

// Decrement quantityReserved for each previously matched reservation.
export async function releaseReservation(reservedItems) {
  for (const r of reservedItems) {
    if (!r.matched || !r.inventoryId) continue
    const invSnap = await getDoc(doc(db, 'inventory', r.inventoryId))
    if (!invSnap.exists()) continue
    const current = invSnap.data().quantityReserved ?? 0
    await updateDoc(doc(db, 'inventory', r.inventoryId), {
      quantityReserved: Math.max(0, current - r.qty),
      updatedAt: serverTimestamp(),
    })
  }
}
