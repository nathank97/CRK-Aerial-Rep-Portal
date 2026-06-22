import { getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { inventoryCol, purchaseOrdersCol } from '../firebase/firestore'
import { db } from '../firebase/config'

const CATALOG_CATEGORY = {
  Drone: 'Drone Kit',
  Part: 'Parts',
  Accessory: 'Accessory',
  Service: 'Other',
  Other: 'Other',
}

/**
 * After saving a catalog item, propagate changes downstream to:
 *   1. inventory records matching by catalogId or SKU
 *   2. purchaseOrder items matching by catalogId or SKU
 *
 * catalogItemId — Firestore doc ID of the catalog item
 * catalogData   — the data object that was just saved (name, sku, manufacturer, type, msrp, …)
 */
export async function syncCatalogChanges(catalogItemId, catalogData) {
  const { name, sku, manufacturer, type, msrp } = catalogData
  const normSku = sku?.trim().toLowerCase() || ''
  const invCategory = CATALOG_CATEGORY[type] ?? null

  const invPatch = {}
  if (name?.trim()) invPatch.modelName = name.trim()
  if (sku?.trim()) invPatch.sku = sku.trim()
  if (manufacturer?.trim()) invPatch.brand = manufacturer.trim()
  if (invCategory) invPatch.category = invCategory
  if (msrp != null) invPatch.msrp = msrp

  if (Object.keys(invPatch).length === 0) return

  // 1. Inventory records
  const [invSnap, poSnap] = await Promise.all([getDocs(inventoryCol), getDocs(purchaseOrdersCol)])

  const invUpdates = []
  for (const d of invSnap.docs) {
    const data = d.data()
    const matchesId = data.catalogId === catalogItemId
    const matchesSku = normSku && (data.sku ?? '').trim().toLowerCase() === normSku
    if (!matchesId && !matchesSku) continue
    invUpdates.push(updateDoc(doc(db, 'inventory', d.id), { ...invPatch, updatedAt: serverTimestamp() }))
  }

  // 2. PO items (so PO UI reflects current catalog state)
  const poUpdates = []
  for (const d of poSnap.docs) {
    const data = d.data()
    if (!Array.isArray(data.items)) continue

    let changed = false
    const updatedItems = data.items.map((item) => {
      const matchesId = item.catalogId === catalogItemId
      const matchesSku = normSku && (item.sku ?? '').trim().toLowerCase() === normSku
      if (!matchesId && !matchesSku) return item
      changed = true
      return {
        ...item,
        modelName: name?.trim() ?? item.modelName,
        sku: sku?.trim() ?? item.sku,
        brand: manufacturer?.trim() ?? item.brand,
        category: invCategory ?? item.category,
        msrp: msrp != null ? msrp : item.msrp,
      }
    })
    if (changed) {
      poUpdates.push(updateDoc(doc(db, 'purchaseOrders', d.id), { items: updatedItems, updatedAt: serverTimestamp() }))
    }
  }

  await Promise.all([...invUpdates, ...poUpdates])
  return { invUpdated: invUpdates.length, posUpdated: poUpdates.length }
}
