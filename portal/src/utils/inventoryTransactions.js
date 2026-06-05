import { addDoc, serverTimestamp } from 'firebase/firestore'
import { inventoryTxCol } from '../firebase/firestore'

/**
 * Write one or more inventory transaction records.
 * type:  'add_stock' | 'po_receipt' | 'deduction' | 'adjustment' | 'reversal' | 'transfer'
 * qty:   positive = stock added, negative = stock removed
 */
export async function writeTx(entries) {
  await Promise.all(
    entries.map((e) =>
      addDoc(inventoryTxCol, {
        type: e.type,
        qty: e.qty,
        modelName: e.modelName ?? null,
        brand: e.brand ?? null,
        sku: e.sku ?? null,
        category: e.category ?? null,
        dealerId: e.dealerId ?? null,
        inventoryId: e.inventoryId ?? null,
        sourceType: e.sourceType ?? null,
        sourceId: e.sourceId ?? null,
        sourceNumber: e.sourceNumber ?? null,
        fromLocation: e.fromLocation ?? null,
        toLocation: e.toLocation ?? null,
        createdBy: e.createdBy ?? '',
        notes: e.notes ?? null,
        createdAt: serverTimestamp(),
      })
    )
  )
}
