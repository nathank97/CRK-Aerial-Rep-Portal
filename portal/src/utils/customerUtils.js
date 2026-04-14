import { addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { customersCol } from '../firebase/firestore'
import { db } from '../firebase/config'

/**
 * Converts a Won lead into a Customer record.
 * Idempotent — if a customer already exists for this lead, returns the existing ID.
 */
export async function convertLeadToCustomer(lead, actingUser) {
  // Already converted
  if (lead.convertedCustomerId) return lead.convertedCustomerId

  // Check if a customer with this leadId already exists
  const existing = await getDocs(query(customersCol, where('sourceLeadId', '==', lead.id)))
  if (!existing.empty) {
    const existingId = existing.docs[0].id
    // Stamp the lead with the id so future calls short-circuit
    await updateDoc(doc(db, 'leads', lead.id), { convertedCustomerId: existingId })
    return existingId
  }

  const now = serverTimestamp()
  const customerRef = await addDoc(customersCol, {
    // Identity
    firstName: lead.firstName,
    lastName: lead.lastName,
    fullName: `${lead.firstName} ${lead.lastName}`,
    company: lead.company ?? null,
    email: lead.email,
    phone: lead.phone,
    address: lead.address ?? null,

    // Dealer link
    assignedDealerId: lead.assignedDealerId ?? null,
    assignedDealerName: lead.assignedDealerName ?? null,

    // Source
    sourceLeadId: lead.id,
    createdByName: actingUser?.displayName ?? 'Unknown',
    createdById: actingUser?.uid ?? null,

    // Tax exempt (defaults — can be edited on customer record)
    taxExempt: false,
    exemptionType: null,
    exemptionCertificate: null,
    exemptionNotes: null,

    notes: lead.notes ?? null,
    createdAt: now,
    updatedAt: now,
  })

  // Back-reference the lead to the new customer
  await updateDoc(doc(db, 'leads', lead.id), {
    convertedCustomerId: customerRef.id,
    convertedAt: now,
  })

  return customerRef.id
}
