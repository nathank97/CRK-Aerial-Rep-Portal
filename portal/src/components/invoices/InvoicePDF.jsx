import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { calcLineTotal } from '../quotes/LineItemBuilder'
import logoUrl from '../../assets/logo.png'

const BRONZE = '#8B6914'
const JET = '#111111'
const OFFWHITE = '#F0F0F0'
const GRAY = '#9A9A9A'
const LIGHT = '#F4F4F5'
const GREEN = '#4CAF7D'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: JET, backgroundColor: '#fff' },
  headerBand: { backgroundColor: JET, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, paddingVertical: 16 },
  logo: { width: 80, height: 40, objectFit: 'contain' },
  headerTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: OFFWHITE, letterSpacing: 3, textTransform: 'uppercase' },
  bronzeLine: { height: 3, backgroundColor: BRONZE },
  body: { paddingHorizontal: 32, paddingTop: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  companyName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: JET },
  companyDetail: { fontSize: 9, color: GRAY, marginTop: 2 },
  metaLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRAY, textTransform: 'uppercase', letterSpacing: 1 },
  metaValue: { fontSize: 10, color: JET, marginTop: 2 },
  metaRow: { marginBottom: 8 },
  sectionHeading: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRAY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, borderBottomWidth: 1, borderColor: '#E5E7EB', paddingBottom: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: LIGHT, paddingVertical: 6, paddingHorizontal: 8 },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: '#F0F0F0' },
  tableRowAlt: { backgroundColor: LIGHT },
  col1: { flex: 3 }, col2: { flex: 1, textAlign: 'right' }, col3: { flex: 1, textAlign: 'right' }, col4: { flex: 1, textAlign: 'right' }, col5: { flex: 1, textAlign: 'right' },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRAY, textTransform: 'uppercase' },
  td: { fontSize: 9, color: JET },
  totalsBlock: { alignSelf: 'flex-end', width: 240, marginTop: 12 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsLabel: { fontSize: 9, color: GRAY },
  totalsValue: { fontSize: 9, color: JET, fontFamily: 'Helvetica-Bold' },
  totalFinal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, marginTop: 4, backgroundColor: JET, paddingHorizontal: 8 },
  totalFinalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BRONZE },
  totalFinalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BRONZE },
  balanceDue: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: '#e8f5e9', marginTop: 2 },
  balanceLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: GREEN },
  balanceValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: GREEN },
  exemptBadge: { backgroundColor: '#e8f5e9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  exemptText: { fontSize: 8, color: GREEN },
  notes: { marginTop: 20, fontSize: 9, color: GRAY },
  footer: { position: 'absolute', bottom: 24, left: 32, right: 32, borderTopWidth: 1, borderColor: '#E5E7EB', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: GRAY },
})

export default function InvoicePDF({ invoice }) {
  const { subtotal = 0, taxAmount = 0, total = 0, amountPaid = 0, lineItems = [] } = invoice
  const balanceDue = Math.max(0, total - amountPaid)

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <View style={s.headerBand}>
          <Image src={logoUrl} style={s.logo} />
          <Text style={s.headerTitle}>Invoice</Text>
        </View>
        <View style={s.bronzeLine} />

        <View style={s.body}>
          <View style={s.row}>
            <View>
              <Text style={s.companyName}>CRK Aerial</Text>
              <Text style={s.companyDetail}>32686 460th Ave.</Text>
              <Text style={s.companyDetail}>Hancock, MN 56244</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Invoice #</Text>
                <Text style={[s.metaValue, { fontFamily: 'Helvetica-Bold' }]}>{invoice.invoiceNumber}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaLabel}>Date</Text>
                <Text style={s.metaValue}>{formatDate(invoice.createdAt)}</Text>
              </View>
              {invoice.dueDate && (
                <View style={s.metaRow}>
                  <Text style={s.metaLabel}>Due Date</Text>
                  <Text style={s.metaValue}>{formatDate(invoice.dueDate)}</Text>
                </View>
              )}
              {invoice.paymentTerms && (
                <View style={s.metaRow}>
                  <Text style={s.metaLabel}>Terms</Text>
                  <Text style={s.metaValue}>{invoice.paymentTerms}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={s.sectionHeading}>Bill To</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold' }}>{invoice.customerName || '—'}</Text>
            {invoice.customerEmail && <Text style={s.companyDetail}>{invoice.customerEmail}</Text>}
            {invoice.customerAddress && <Text style={s.companyDetail}>{invoice.customerAddress}</Text>}
          </View>

          <Text style={s.sectionHeading}>Line Items</Text>
          <View style={s.tableHeader}>
            <Text style={[s.col1, s.th]}>Description</Text>
            <Text style={[s.col2, s.th]}>Qty</Text>
            <Text style={[s.col3, s.th]}>Unit Price</Text>
            <Text style={[s.col4, s.th]}>Discount</Text>
            <Text style={[s.col5, s.th]}>Total</Text>
          </View>
          {lineItems.map((item, i) => {
            const disc = item.discount
              ? item.discountType === 'percent' ? `${item.discount}%` : formatCurrency(item.discount)
              : '—'
            return (
              <View key={item.id ?? i} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
                <Text style={[s.col1, s.td]}>{item.description}</Text>
                <Text style={[s.col2, s.td]}>{item.quantity}</Text>
                <Text style={[s.col3, s.td]}>{formatCurrency(item.unitPrice)}</Text>
                <Text style={[s.col4, s.td]}>{disc}</Text>
                <Text style={[s.col5, s.td]}>{formatCurrency(calcLineTotal(item))}</Text>
              </View>
            )
          })}

          <View style={s.totalsBlock}>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Subtotal</Text>
              <Text style={s.totalsValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>
                Tax ({invoice.taxRate ?? 0}%){invoice.taxExempt ? ' — EXEMPT' : ''}
              </Text>
              <Text style={s.totalsValue}>{formatCurrency(taxAmount)}</Text>
            </View>
            {invoice.taxExempt && invoice.exemptionType && (
              <View style={s.exemptBadge}>
                <Text style={s.exemptText}>
                  Exemption: {invoice.exemptionType}{invoice.exemptionCertificate ? ` · Cert #${invoice.exemptionCertificate}` : ''}
                </Text>
              </View>
            )}
            <View style={s.totalFinal}>
              <Text style={s.totalFinalLabel}>TOTAL DUE</Text>
              <Text style={s.totalFinalValue}>{formatCurrency(total)}</Text>
            </View>
            {amountPaid > 0 && (
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>Amount Paid</Text>
                <Text style={s.totalsValue}>({formatCurrency(amountPaid)})</Text>
              </View>
            )}
            <View style={s.balanceDue}>
              <Text style={s.balanceLabel}>BALANCE DUE</Text>
              <Text style={s.balanceValue}>{formatCurrency(balanceDue)}</Text>
            </View>
          </View>

          {invoice.notes && (
            <View style={s.notes}>
              <Text><Text style={{ fontFamily: 'Helvetica-Bold' }}>Notes: </Text>{invoice.notes}</Text>
            </View>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>CRK Aerial · EST. 1941 · 32686 460th Ave. Hancock, MN 56244</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
