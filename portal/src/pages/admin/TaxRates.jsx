import { useState, useEffect, useMemo } from 'react'
import { onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { taxRatesCol } from '../../firebase/firestore'
import { db } from '../../firebase/config'
import { formatPercent } from '../../utils/formatters'

// All 50 US states + DC
const US_STATES = [
  { abbr: 'AL', name: 'Alabama' }, { abbr: 'AK', name: 'Alaska' }, { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' }, { abbr: 'CA', name: 'California' }, { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' }, { abbr: 'DE', name: 'Delaware' }, { abbr: 'DC', name: 'District of Columbia' },
  { abbr: 'FL', name: 'Florida' }, { abbr: 'GA', name: 'Georgia' }, { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' }, { abbr: 'IL', name: 'Illinois' }, { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' }, { abbr: 'KS', name: 'Kansas' }, { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' }, { abbr: 'ME', name: 'Maine' }, { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' }, { abbr: 'MI', name: 'Michigan' }, { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' }, { abbr: 'MO', name: 'Missouri' }, { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' }, { abbr: 'NV', name: 'Nevada' }, { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' }, { abbr: 'NM', name: 'New Mexico' }, { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' }, { abbr: 'ND', name: 'North Dakota' }, { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' }, { abbr: 'OR', name: 'Oregon' }, { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' }, { abbr: 'SC', name: 'South Carolina' }, { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' }, { abbr: 'TX', name: 'Texas' }, { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' }, { abbr: 'VA', name: 'Virginia' }, { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' }, { abbr: 'WI', name: 'Wisconsin' }, { abbr: 'WY', name: 'Wyoming' },
]

// ─── Edit Row ────────────────────────────────────────────────────────────────

function RateRow({ state, existingRate, onSaved }) {
  const hasRate = existingRate != null
  const [editing, setEditing] = useState(false)
  const [rate, setRate] = useState(existingRate?.rate ?? '')
  const [notes, setNotes] = useState(existingRate?.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'taxRates', state.abbr), {
        state: state.abbr,
        stateName: state.name,
        rate: parseFloat(rate) || 0,
        notes: notes.trim(),
        updatedAt: serverTimestamp(),
      })
      setEditing(false)
      onSaved?.()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!hasRate) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'taxRates', state.abbr))
      setEditing(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  function startEdit() {
    setRate(existingRate?.rate ?? '')
    setNotes(existingRate?.notes ?? '')
    setEditing(true)
  }

  if (editing) {
    return (
      <tr className="bg-[#FFFDF5] border-b border-gray-100">
        <td className="py-2 px-4">
          <span className="font-mono text-xs font-bold text-[#8B6914]">{state.abbr}</span>
          <span className="text-sm text-[#1A1A1A] ml-2">{state.name}</span>
        </td>
        <td className="py-2 px-4">
          <div className="relative w-28">
            <input
              type="number" min="0" max="20" step="0.001"
              value={rate} onChange={(e) => setRate(e.target.value)}
              className="w-full border border-[#8B6914] rounded-lg px-3 py-1.5 text-sm pr-7 focus:outline-none"
              autoFocus
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9A9A9A]">%</span>
          </div>
        </td>
        <td className="py-2 px-4">
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#8B6914]" />
        </td>
        <td className="py-2 px-4">
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="text-xs bg-[#8B6914] text-white px-3 py-1.5 rounded-lg font-medium hover:bg-[#7a5c12] disabled:opacity-50 transition-colors">
              {saving ? '…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)}
              className="text-xs border border-gray-200 text-[#1A1A1A] px-3 py-1.5 rounded-lg hover:bg-[#F4F4F5] transition-colors">
              Cancel
            </button>
            {hasRate && (
              <button onClick={remove} disabled={saving}
                className="text-xs text-[#D95F5F] hover:underline ml-1">
                Remove
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`border-b border-gray-50 transition-colors ${hasRate ? 'hover:bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA] opacity-60'}`}>
      <td className="py-2.5 px-4">
        <span className="font-mono text-xs font-bold text-[#8B6914]">{state.abbr}</span>
        <span className="text-sm text-[#1A1A1A] ml-2">{state.name}</span>
      </td>
      <td className="py-2.5 px-4">
        {hasRate ? (
          <span className="text-sm font-semibold text-[#1A1A1A]">{existingRate.rate}%</span>
        ) : (
          <span className="text-xs text-[#9A9A9A]">—</span>
        )}
      </td>
      <td className="py-2.5 px-4 text-xs text-[#9A9A9A]">{existingRate?.notes || '—'}</td>
      <td className="py-2.5 px-4">
        <button onClick={startEdit}
          className="text-xs text-[#8B6914] hover:underline font-medium">
          {hasRate ? 'Edit' : 'Set Rate'}
        </button>
      </td>
    </tr>
  )
}

// ─── Bulk Seed Modal ─────────────────────────────────────────────────────────

// Default 2024 average combined state+local rates (approximations)
const SEED_RATES = {
  AL: 9.22, AK: 1.76, AZ: 8.37, AR: 9.47, CA: 8.82, CO: 7.77, CT: 6.35, DE: 0,
  DC: 6, FL: 7.02, GA: 7.35, HI: 4.44, ID: 6.03, IL: 8.82, IN: 7, IA: 6.94,
  KS: 8.68, KY: 6, LA: 9.55, ME: 5.5, MD: 6, MA: 6.25, MI: 6, MN: 7.49,
  MS: 7.07, MO: 8.29, MT: 0, NE: 6.94, NV: 8.23, NH: 0, NJ: 6.6, NM: 7.83,
  NY: 8.52, NC: 6.99, ND: 6.96, OH: 7.24, OK: 8.95, OR: 0, PA: 6.34, RI: 7,
  SC: 7.44, SD: 6.4, TN: 9.55, TX: 8.19, UT: 7.19, VT: 6.22, VA: 5.73,
  WA: 9.23, WV: 6.51, WI: 5.43, WY: 5.44,
}

function SeedModal({ onClose, onSeeded }) {
  const [seeding, setSeeding] = useState(false)

  async function seed() {
    setSeeding(true)
    try {
      await Promise.all(
        US_STATES.map((s) =>
          setDoc(doc(db, 'taxRates', s.abbr), {
            state: s.abbr,
            stateName: s.name,
            rate: SEED_RATES[s.abbr] ?? 0,
            notes: 'Auto-seeded with 2024 average combined rate',
            updatedAt: serverTimestamp(),
          })
        )
      )
      onSeeded()
    } catch (e) {
      console.error(e)
      setSeeding(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Seed Default Rates?</h3>
        <p className="text-sm text-[#9A9A9A] mb-5">
          This will populate all 50 states with approximate 2024 average combined state + local tax rates. You can edit any rate after seeding.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </button>
          <button onClick={seed} disabled={seeding}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {seeding ? 'Seeding…' : 'Seed All States'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TaxRates() {
  const [rates, setRates] = useState({}) // keyed by state abbr
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showSeed, setShowSeed] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(taxRatesCol, (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.id] = { id: d.id, ...d.data() } })
      setRates(map)
      setLoading(false)
    })
    return unsub
  }, [])

  const filtered = useMemo(() => {
    return US_STATES.filter((s) =>
      !search || s.abbr.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [search])

  const configuredCount = US_STATES.filter((s) => rates[s.abbr] != null).length

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Tax Rates</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">{configuredCount} of {US_STATES.length} states configured</p>
        </div>
        <button onClick={() => setShowSeed(true)}
          className="border border-gray-200 text-[#1A1A1A] px-4 py-2 rounded-lg text-sm hover:bg-[#F4F4F5] transition-colors">
          Seed Defaults
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-[#8B6914]/8 border border-[#8B6914]/20 rounded-xl p-4 mb-5 text-sm text-[#5a4010]">
        <strong>How this works:</strong> When an invoice is created, the customer's state automatically looks up the rate from this table. Tax rates are editable per invoice if a manual override is needed. States with no rate set default to 0%.
      </div>

      {/* Search */}
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by state name or abbreviation…"
        className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] mb-5 bg-white" />

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-[#F4F4F5]">
              {['State', 'Tax Rate', 'Notes', 'Actions'].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse border-b border-gray-50">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <td key={j} className="py-3 px-4"><div className="h-4 bg-gray-100 rounded w-3/4" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="py-12 text-center text-[#9A9A9A] text-sm">No states match your search.</td></tr>
            ) : filtered.map((state) => (
              <RateRow
                key={state.abbr}
                state={state}
                existingRate={rates[state.abbr] ?? null}
              />
            ))}
          </tbody>
        </table>
      </div>

      {showSeed && <SeedModal onClose={() => setShowSeed(false)} onSeeded={() => setShowSeed(false)} />}
    </div>
  )
}
