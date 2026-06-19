import { useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCatalog } from '../../hooks/useCatalog'
import { useAuth } from '../../context/AuthContext'
import { getDealerPrice, isBelowDealerCost } from '../../utils/pricing'
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

  const dealerPrice = (item) => getDealerPrice(item, profile)

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

// ─── Sortable row ─────────────────────────────────────────────────────────────

function SortableRow({
  item,
  onUpdate,
  onRemove,
  showDealerPricing,
  profile,
  inputCls,
  openDropdown,
  setOpenDropdown,
  dropdownSearch,
  setDropdownSearch,
  positionDropdown,
  inputRefs,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 1 : undefined,
    position: isDragging ? 'relative' : undefined,
  }

  const lineTotal = calcLineTotal(item)
  const belowCost =
    showDealerPricing &&
    profile?.role === 'dealer' &&
    isBelowDealerCost(item.unitPrice, item, profile)

  return (
    <tr ref={setNodeRef} style={style} className="group">
      {/* Drag handle */}
      <td className="py-2 pl-1 pr-2 w-7">
        <button
          type="button"
          {...attributes}
          {...listeners}
          tabIndex={-1}
          title="Drag to reorder"
          className="cursor-grab active:cursor-grabbing text-[#C8C8C8] hover:text-[#9A9A9A] transition-colors touch-none select-none leading-none opacity-0 group-hover:opacity-100"
        >
          <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
            <circle cx="3" cy="3"  r="1.5" />
            <circle cx="9" cy="3"  r="1.5" />
            <circle cx="3" cy="8"  r="1.5" />
            <circle cx="9" cy="8"  r="1.5" />
            <circle cx="3" cy="13" r="1.5" />
            <circle cx="9" cy="13" r="1.5" />
          </svg>
        </button>
      </td>

      {/* Description */}
      <td className="py-2 pr-3">
        <div className="relative">
          <input
            ref={el => { inputRefs.current[item.id] = el }}
            value={item.description}
            onChange={(e) => {
              onUpdate(item.id, 'description', e.target.value)
              setDropdownSearch((p) => ({ ...p, [item.id]: e.target.value }))
              setOpenDropdown(item.id)
              positionDropdown(item.id)
            }}
            onFocus={() => {
              setDropdownSearch((p) => ({ ...p, [item.id]: item.description }))
              setOpenDropdown(item.id)
              positionDropdown(item.id)
            }}
            onBlur={() => setTimeout(() => setOpenDropdown(null), 150)}
            placeholder="Description… or type to search catalog"
            className={inputCls}
          />
        </div>
        {item.type === 'catalog' && showDealerPricing && profile?.role === 'dealer' && item.msrp && (
          <p className="text-xs text-[#9A9A9A] mt-0.5">
            MSRP: {formatCurrency(item.msrp)} · Your cost: {formatCurrency(item.dealerCost)}
          </p>
        )}
        {belowCost && (
          <p className="text-xs text-[#E6A817] mt-0.5">⚠️ Price is below your dealer cost</p>
        )}
      </td>

      {/* Qty */}
      <td className="py-2 px-2">
        <input type="number" min="1" value={item.quantity}
          onChange={(e) => onUpdate(item.id, 'quantity', parseFloat(e.target.value) || 1)}
          className={`${inputCls} text-right`} style={{ minWidth: '72px' }} />
      </td>

      {/* Unit Price */}
      <td className="py-2 px-2">
        <input type="number" min="0" step="0.01" value={item.unitPrice}
          onChange={(e) => onUpdate(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
          className={`${inputCls} text-right ${belowCost ? 'border-[#E6A817]' : ''}`} />
      </td>

      {/* Discount */}
      <td className="py-2 px-2">
        <div className="flex gap-1">
          <input type="number" min="0" value={item.discount ?? 0}
            onChange={(e) => onUpdate(item.id, 'discount', parseFloat(e.target.value) || 0)}
            className={`${inputCls} text-right`} style={{ minWidth: '72px' }} />
          <select value={item.discountType ?? 'percent'}
            onChange={(e) => onUpdate(item.id, 'discountType', e.target.value)}
            className="border border-gray-200 rounded px-1 py-1.5 text-xs focus:outline-none focus:border-[#8B6914] bg-white">
            <option value="percent">%</option>
            <option value="flat">$</option>
          </select>
        </div>
      </td>

      {/* Line total */}
      <td className="py-2 pl-2 text-right font-semibold text-[#1A1A1A] whitespace-nowrap">
        {formatCurrency(lineTotal)}
      </td>

      {/* Remove */}
      <td className="py-2 pl-1">
        <button onClick={() => onRemove(item.id)}
          className="text-[#9A9A9A] hover:text-[#D95F5F] transition-colors opacity-0 group-hover:opacity-100 text-lg leading-none">
          ×
        </button>
      </td>
    </tr>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LineItemBuilder({ items, onChange, showDealerPricing = true }) {
  const { profile } = useAuth()
  const { catalog } = useCatalog()
  const [showCatalog, setShowCatalog] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [dropdownSearch, setDropdownSearch] = useState({})
  const [dropdownAnchor, setDropdownAnchor] = useState(null)
  const inputRefs = useRef({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      onChange(arrayMove(items, oldIndex, newIndex))
    }
  }

  function positionDropdown(itemId) {
    const el = inputRefs.current[itemId]
    if (el) {
      const rect = el.getBoundingClientRect()
      setDropdownAnchor({ top: rect.bottom + 2, left: rect.left, width: rect.width })
    }
  }

  const update = (id, field, value) => {
    onChange(items.map((item) => item.id === id ? { ...item, [field]: value } : item))
  }

  const remove = (id) => onChange(items.filter((item) => item.id !== id))

  const addCustom = () => onChange([...items, newCustomItem()])

  const addFromCatalog = (catalogItem) => {
    const dealerCost = getDealerPrice(catalogItem, profile)
    onChange([...items, {
      id: crypto.randomUUID(),
      type: 'catalog',
      catalogId: catalogItem.id,
      description: catalogItem.name,
      quantity: 1,
      unitPrice: catalogItem.msrp ?? 0,
      discount: 0,
      discountType: 'percent',
      msrp: catalogItem.msrp ?? null,
      dealerCost: dealerCost ?? null,
    }])
    setShowCatalog(false)
  }

  const selectCatalogForItem = (itemId, catalogItem) => {
    const dealerCost = getDealerPrice(catalogItem, profile)
    onChange(items.map((item) =>
      item.id === itemId ? {
        ...item,
        type: 'catalog',
        catalogId: catalogItem.id,
        description: catalogItem.name,
        unitPrice: catalogItem.msrp ?? item.unitPrice,
        msrp: catalogItem.msrp ?? null,
        dealerCost: dealerCost ?? null,
      } : item
    ))
    setOpenDropdown(null)
    setDropdownSearch((p) => ({ ...p, [itemId]: '' }))
  }

  const catalogMatches = useMemo(() => {
    if (!openDropdown) return []
    const q = (dropdownSearch[openDropdown] ?? '').toLowerCase().trim()
    if (!q) return []
    return catalog.filter((c) =>
      c.name?.toLowerCase().includes(q) || c.sku?.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [openDropdown, dropdownSearch, catalog])

  const inputCls = 'border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#8B6914] bg-white w-full'

  return (
    <div>
      {showCatalog && <CatalogModal onSelect={addFromCatalog} onClose={() => setShowCatalog(false)} />}

      {items.length > 0 && (
        <div className="mb-3 overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="w-7" />
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-full">Description</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap w-24">Qty</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap w-28">Unit Price</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap w-40">Discount</th>
                  <th className="text-right py-2 pl-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap w-24">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <SortableRow
                      key={item.id}
                      item={item}
                      onUpdate={update}
                      onRemove={remove}
                      showDealerPricing={showDealerPricing}
                      profile={profile}
                      inputCls={inputCls}
                      openDropdown={openDropdown}
                      setOpenDropdown={setOpenDropdown}
                      dropdownSearch={dropdownSearch}
                      setDropdownSearch={setDropdownSearch}
                      positionDropdown={positionDropdown}
                      inputRefs={inputRefs}
                    />
                  ))}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
      )}

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

      {openDropdown && catalogMatches.length > 0 && dropdownAnchor && createPortal(
        <ul
          style={{ position: 'fixed', top: dropdownAnchor.top, left: dropdownAnchor.left, width: dropdownAnchor.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-44 overflow-y-auto text-sm">
          <li className="px-3 py-1.5 text-xs text-[#9A9A9A] font-semibold uppercase tracking-wider border-b border-gray-100">
            Catalog matches
          </li>
          {catalogMatches.map((c) => (
            <li key={c.id}
              onMouseDown={() => selectCatalogForItem(openDropdown, c)}
              className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-[#F4F4F5] cursor-pointer">
              <div className="min-w-0">
                <p className="font-medium text-[#1A1A1A] truncate">{c.name}</p>
                {c.sku && <p className="text-xs text-[#9A9A9A]">SKU: {c.sku}</p>}
              </div>
              {c.msrp != null && (
                <span className="text-xs font-medium text-[#8B6914] shrink-0">{formatCurrency(c.msrp)}</span>
              )}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  )
}
