import { useState } from 'react'
import { useCatalog } from '../../hooks/useCatalog'
import { useAuth } from '../../context/AuthContext'
import { calcDealerPrice, isBelowDealerCost } from '../../utils/pricing'
import { formatCurrency } from '../../utils/formatters'

/** Calculate a single line item total after discount */
export function calcLineTotal(item) {
  const base = (item.quantity ?? 1) * (item.unitPrice ?? 0)
  if (!item.discount) return base
  if (item.discountType === 'percent') return base * (1 - item.discount / 100)
  return Math.max(0, base - item.discount)
}

/** Calculate overall quote/invoice totals */
export function calcTotals(lineItems, taxRate = 0, taxExempt = false) {
  const subtotal = lineItems.reduce((sum, item) => sum + calcLineTotal(item), 0)
  const taxAmount = taxExempt ? 0 : subtotal * ((taxRate ?? 0) / 100)
  const total = subtotal + taxAmount
  return { subtotal, taxAmount, total }
}

function newCustomItem() {
  return {
    id: crypto.randomUUID(),
    type: 'custom',
    catalogId: null,
    description: '',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    discountType: 'percent',
    msrp: null,
    dealerCost: null,
  }
}

function CatalogModal({ onSelect, onClose }) {
  const { catalog, loading } = useCatalog()
  const { profile } = useAuth()
  const [search, setSearch] = useState('')

  const filtered = catalog.filter((item) =>
    item.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.sku?.toLowerCase().includes(search.toLowerCase())
  )

  const dealerPrice = (item) =>
    calcDealerPrice(item.msrp, profile?.marginPercent)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Add from Catalog</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-3 border-b border-gray-100">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search catalog…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]" />
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loading ? (
            <div className="p-6 text-center text-[#9A9A9A] text-sm animate-pulse">Loading catalog…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-[#9A9A9A] text-sm">
              {catalog.length === 0
                ? 'Catalog is empty. Add items in Admin → Catalog.'
                : 'No items match your search.'}
            </div>
          ) : filtered.map((item) => (
            <div key={item.id} onClick={() => onSelect(item)}
              className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#F4F4F5] cursor-pointer transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1A1A1A] truncate">{item.name}</p>
                {item.sku && <p className="text-xs text-[#9A9A9A]">SKU: {item.sku}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-[#1A1A1A]">{formatCurrency(item.msrp)}</p>
                {profile?.role === 'dealer' && (
                  <p className="text-xs text-[#4CAF7D]">Your price: {formatCurrency(dealerPrice(item))}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LineItemBuilder({ items, onChange, showDealerPricing = true }) {
  const { profile } = useAuth()
  const [showCatalog, setShowCatalog] = useState(false)

  const update = (id, field, value) => {
    onChange(items.map((item) => item.id === id ? { ...item, [field]: value } : item))
  }

  const remove = (id) => onChange(items.filter((item) => item.id !== id))

  const addCustom = () => onChange([...items, newCustomItem()])

  const addFromCatalog = (catalogItem) => {
    const marginPercent = profile?.marginPercent ?? 0
    const dealerCost = calcDealerPrice(catalogItem.msrp, marginPercent)
    const unitPrice = profile?.role === 'dealer' ? dealerCost : catalogItem.msrp

    onChange([...items, {
      id: crypto.randomUUID(),
      type: 'catalog',
      catalogId: catalogItem.id,
      description: catalogItem.name,
      quantity: 1,
      unitPrice: unitPrice ?? 0,
      discount: 0,
      discountType: 'percent',
      msrp: catalogItem.msrp ?? null,
      dealerCost: dealerCost ?? null,
    }])
    setShowCatalog(false)
  }

  const inputCls = 'border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#8B6914] bg-white w-full'

  return (
    <div>
      {showCatalog && <CatalogModal onSelect={addFromCatalog} onClose={() => setShowCatalog(false)} />}

      {/* Line items table */}
      {items.length > 0 && (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-full">Description</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap w-16">Qty</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap w-28">Unit Price</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap w-32">Discount</th>
                <th className="text-right py-2 pl-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap w-24">Total</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => {
                const lineTotal = calcLineTotal(item)
                const belowCost = showDealerPricing && profile?.role === 'dealer' &&
                  item.msrp != null && isBelowDealerCost(item.unitPrice, item.msrp, profile.marginPercent)

                return (
                  <tr key={item.id} className="group">
                    <td className="py-2 pr-3">
                      <input value={item.description} onChange={(e) => update(item.id, 'description', e.target.value)}
                        placeholder="Description…" className={inputCls} />
                      {item.type === 'catalog' && showDealerPricing && profile?.role === 'dealer' && item.msrp && (
                        <p className="text-xs text-[#9A9A9A] mt-0.5">
                          MSRP: {formatCurrency(item.msrp)} · Your cost: {formatCurrency(item.dealerCost)}
                        </p>
                      )}
                      {belowCost && (
                        <p className="text-xs text-[#E6A817] mt-0.5">⚠️ Price is below your dealer cost</p>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <input type="number" min="1" value={item.quantity}
                        onChange={(e) => update(item.id, 'quantity', parseFloat(e.target.value) || 1)}
                        className={`${inputCls} text-right`} />
                    </td>
                    <td className="py-2 px-2">
                      <input type="number" min="0" step="0.01" value={item.unitPrice}
                        onChange={(e) => update(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className={`${inputCls} text-right ${belowCost ? 'border-[#E6A817]' : ''}`} />
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex gap-1">
                        <input type="number" min="0" value={item.discount ?? 0}
                          onChange={(e) => update(item.id, 'discount', parseFloat(e.target.value) || 0)}
                          className={`${inputCls} text-right`} style={{ maxWidth: '60px' }} />
                        <select value={item.discountType ?? 'percent'}
                          onChange={(e) => update(item.id, 'discountType', e.target.value)}
                          className="border border-gray-200 rounded px-1 py-1.5 text-xs focus:outline-none focus:border-[#8B6914] bg-white">
                          <option value="percent">%</option>
                          <option value="flat">$</option>
                        </select>
                      </div>
                    </td>
                    <td className="py-2 pl-2 text-right font-semibold text-[#1A1A1A] whitespace-nowrap">
                      {formatCurrency(lineTotal)}
                    </td>
                    <td className="py-2 pl-1">
                      <button onClick={() => remove(item.id)}
                        className="text-[#9A9A9A] hover:text-[#D95F5F] transition-colors opacity-0 group-hover:opacity-100 text-lg leading-none">
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add buttons */}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setShowCatalog(true)}
          className="text-sm border border-[#8B6914] text-[#8B6914] hover:bg-[#8B6914]/5 px-3 py-1.5 rounded-lg transition-colors font-medium">
          + From Catalog
        </button>
        <button type="button" onClick={addCustom}
          className="text-sm border border-gray-200 text-[#1A1A1A] hover:bg-[#F4F4F5] px-3 py-1.5 rounded-lg transition-colors">
          + Custom Line Item
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-center text-[#9A9A9A] text-sm py-6 border-2 border-dashed border-gray-200 rounded-xl mt-3">
          No line items yet. Add from catalog or create a custom item.
        </p>
      )}
    </div>
  )
}
