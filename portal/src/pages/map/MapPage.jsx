import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { useLeads } from '../../hooks/useLeads'
import { useCustomers } from '../../hooks/useCustomers'
import { useDealers } from '../../hooks/useUsers'
import { useAuth } from '../../context/AuthContext'

const MAPS_API_KEY = 'AIzaSyCbDX3uCDdLFh9MkhxXlc83UxyqAQt58A4'

// Status → pin color
const LEAD_STATUS_COLOR = {
  New: '#4A90B8',
  Contacted: '#9B59B6',
  Pending: '#E6A817',
  'Demo Scheduled': '#F39C12',
  'Proposal Sent': '#E67E22',
  Won: '#4CAF7D',
  Lost: '#D95F5F',
}

function statusColor(status) {
  return LEAD_STATUS_COLOR[status] ?? '#8B6914'
}

// ─── Geocoder component ───────────────────────────────────────────────────────

function GeocoderAndMarkers({ items, selectedId, onSelect, onClose, navigate }) {
  const geocodingLib = useMapsLibrary('geocoding')
  const [geocoded, setGeocoded] = useState({}) // key: id → { lat, lng }

  useEffect(() => {
    if (!geocodingLib) return
    const geocoder = new geocodingLib.Geocoder()

    const pending = items.filter((item) => item.address && !geocoded[item.id])
    if (pending.length === 0) return

    // Batch geocode with staggering to avoid rate limits
    pending.forEach((item, i) => {
      setTimeout(() => {
        geocoder.geocode({ address: item.address }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const loc = results[0].geometry.location
            setGeocoded((prev) => ({
              ...prev,
              [item.id]: { lat: loc.lat(), lng: loc.lng() },
            }))
          }
        })
      }, i * 150)
    })
  }, [geocodingLib, items])

  const selectedItem = selectedId ? items.find((i) => i.id === selectedId) : null
  const selectedCoords = selectedId ? geocoded[selectedId] : null

  return (
    <>
      {items.map((item) => {
        const coords = geocoded[item.id]
        if (!coords) return null
        const isLead = item._type === 'lead'
        const color = isLead ? statusColor(item.status) : '#4CAF7D'

        return (
          <AdvancedMarker
            key={item.id}
            position={coords}
            onClick={() => onSelect(item.id)}
          >
            <div
              className="flex items-center justify-center rounded-full border-2 border-white shadow-md cursor-pointer transition-transform hover:scale-110"
              style={{
                width: 28,
                height: 28,
                backgroundColor: color,
                fontSize: 12,
              }}
              title={item._displayName}
            >
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>
                {isLead ? 'L' : 'C'}
              </span>
            </div>
          </AdvancedMarker>
        )
      })}

      {selectedItem && selectedCoords && (
        <InfoWindow position={selectedCoords} onCloseClick={onClose}>
          <div className="text-[#1A1A1A] min-w-[180px]">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: selectedItem._type === 'lead' ? statusColor(selectedItem.status) : '#4CAF7D' }}
              />
              <span className="text-xs font-semibold uppercase text-gray-500">
                {selectedItem._type === 'lead' ? 'Lead' : 'Customer'}
              </span>
            </div>
            <p className="font-bold text-sm">{selectedItem._displayName}</p>
            {selectedItem.company && <p className="text-xs text-gray-500">{selectedItem.company}</p>}
            <p className="text-xs text-gray-400 mt-0.5">{selectedItem.address}</p>
            {selectedItem.status && (
              <p className="text-xs mt-1">
                <span className="font-medium">Status:</span> {selectedItem.status}
              </p>
            )}
            {selectedItem.assignedDealerName && (
              <p className="text-xs">
                <span className="font-medium">Dealer:</span> {selectedItem.assignedDealerName}
              </p>
            )}
            {selectedItem.droneModels?.length > 0 && (
              <p className="text-xs">
                <span className="font-medium">Interest:</span> {selectedItem.droneModels.join(', ')}
              </p>
            )}
            <button
              onClick={() => navigate(selectedItem._type === 'lead' ? `/leads/${selectedItem.id}` : `/customers/${selectedItem.id}`)}
              className="mt-2 w-full text-xs bg-[#8B6914] text-white rounded-md py-1.5 font-medium hover:bg-[#7a5c12] transition-colors"
            >
              View Record →
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MapPage() {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { leads, loading: leadsLoading } = useLeads()
  const { customers, loading: customersLoading } = useCustomers()
  const { dealers } = useDealers()

  const [showLeads, setShowLeads] = useState(true)
  const [showCustomers, setShowCustomers] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDealer, setFilterDealer] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const loading = leadsLoading || customersLoading

  // Normalize leads + customers into a unified list
  const allItems = useMemo(() => {
    const result = []

    if (showLeads) {
      leads
        .filter((l) => l.address)
        .filter((l) => !filterStatus || l.status === filterStatus)
        .filter((l) => !filterDealer || l.assignedDealerId === filterDealer)
        .forEach((l) => result.push({
          ...l,
          _type: 'lead',
          _displayName: `${l.firstName ?? ''} ${l.lastName ?? ''}`.trim() || l.email,
        }))
    }

    if (showCustomers) {
      customers
        .filter((c) => c.address)
        .filter((c) => !filterDealer || c.assignedDealerId === filterDealer)
        .forEach((c) => result.push({
          ...c,
          _type: 'customer',
          _displayName: c.name || c.fullName || c.email,
        }))
    }

    return result
  }, [leads, customers, showLeads, showCustomers, filterStatus, filterDealer])

  const noAddressCount = useMemo(() => {
    let count = 0
    if (showLeads) count += leads.filter((l) => !l.address).length
    if (showCustomers) count += customers.filter((c) => !c.address).length
    return count
  }, [leads, customers, showLeads, showCustomers])

  const LEAD_STATUSES = ['New', 'Contacted', 'Pending', 'Demo Scheduled', 'Proposal Sent', 'Won', 'Lost']

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-screen">
      {/* Controls bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex flex-wrap items-center gap-3">
        <h1 className="text-base font-bold text-[#1A1A1A] mr-2">Customer Map</h1>

        {/* Type toggles */}
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input type="checkbox" checked={showLeads} onChange={(e) => setShowLeads(e.target.checked)} className="accent-[#4A90B8]" />
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#4A90B8]" />
          Leads
        </label>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input type="checkbox" checked={showCustomers} onChange={(e) => setShowCustomers(e.target.checked)} className="accent-[#4CAF7D]" />
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#4CAF7D]" />
          Customers
        </label>

        {/* Status filter (leads only) */}
        {showLeads && (
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#8B6914] bg-white">
            <option value="">All Statuses</option>
            {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}

        {/* Dealer filter (admin only) */}
        {isAdmin && dealers.length > 0 && (
          <select value={filterDealer} onChange={(e) => setFilterDealer(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#8B6914] bg-white">
            <option value="">All Dealers</option>
            {dealers.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}
          </select>
        )}

        <span className="text-xs text-[#9A9A9A] ml-auto">
          {allItems.length} pin{allItems.length !== 1 ? 's' : ''}
          {noAddressCount > 0 && ` · ${noAddressCount} without address`}
        </span>
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 bg-[#FAFAFA] border-b border-gray-100 px-4 py-2 flex flex-wrap gap-3">
        {showLeads && Object.entries(LEAD_STATUS_COLOR).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-[#9A9A9A]">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            {status}
          </span>
        ))}
        {showCustomers && (
          <span className="flex items-center gap-1.5 text-xs text-[#9A9A9A]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#4CAF7D]" />
            Customer
          </span>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center">
            <div className="animate-pulse text-sm text-[#9A9A9A]">Loading records…</div>
          </div>
        )}
        <APIProvider apiKey={MAPS_API_KEY}>
          <Map
            mapId="crk-aerial-map"
            defaultCenter={{ lat: 44.5, lng: -93.0 }}
            defaultZoom={7}
            gestureHandling="greedy"
            disableDefaultUI={false}
            style={{ width: '100%', height: '100%' }}
          >
            <GeocoderAndMarkers
              items={allItems}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onClose={() => setSelectedId(null)}
              navigate={navigate}
            />
          </Map>
        </APIProvider>
      </div>
    </div>
  )
}
