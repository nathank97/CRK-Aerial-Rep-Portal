import { useMemo } from 'react'
import { writeBatch, doc, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAllUsers } from '../hooks/useUsers'

/** Users a quote/invoice can be assigned to: reps (dealer role) first, then admins. */
export function useAssignableReps() {
  const { users, loading } = useAllUsers()
  const reps = useMemo(() => {
    const byName = (a, b) => (a.displayName ?? a.email ?? '').localeCompare(b.displayName ?? b.email ?? '')
    const dealers = users.filter((u) => u.role === 'dealer' && !u.deleted).sort(byName)
    const admins = users.filter((u) => u.role === 'admin' && !u.deleted).sort(byName)
    return { dealers, admins, all: [...dealers, ...admins] }
  }, [users])
  return { ...reps, loading }
}

export const repLabel = (u) => u?.displayName || u?.email || 'Unnamed user'

/**
 * Reassign one or more quotes/invoices to a rep. Changes dealerId (which
 * controls whose portal the record shows in) and dealerName, and appends an
 * entry to assignmentHistory for auditing.
 *
 * @param {'quotes'|'invoices'} collectionName
 * @param {Array<{id: string, dealerId?: string, dealerName?: string}>} records
 * @param {{id: string, displayName?: string, email?: string}} rep
 * @param {string} byName — who made the change
 */
export async function assignToRep(collectionName, records, rep, byName) {
  const toName = repLabel(rep)
  const toMove = records.filter((r) => r.dealerId !== rep.id)
  // Firestore batches cap at 500 writes
  for (let i = 0; i < toMove.length; i += 450) {
    const batch = writeBatch(db)
    for (const r of toMove.slice(i, i + 450)) {
      batch.update(doc(db, collectionName, r.id), {
        dealerId: rep.id,
        dealerName: toName,
        assignedAt: serverTimestamp(),
        assignedBy: byName,
        assignmentHistory: arrayUnion({
          fromId: r.dealerId ?? null,
          fromName: r.dealerName ?? null,
          toId: rep.id,
          toName,
          by: byName,
          at: new Date(),
        }),
        updatedAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }
  return toMove.length
}
