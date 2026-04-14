import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { updateDoc, doc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore'
import { useTerritories } from '../../../hooks/useTerritories'
import { db } from '../../../firebase/config'
import { leadsCol, customersCol } from '../../../firebase/firestore'

const MAPS_API_KEY = 'AIzaSyCbDX3uCDdLFh9MkhxXlc83UxyqAQt58A4'

const STATUS_COLOR = {
  Active: '#4CAF7D',
  Open: '#E6A817',
  Planned: '#9A9A9A',
}

function centroid(polygon) {
  if (!polygon?.length) return null
  const lat = polygon.reduce((s, p) => s + p.lat, 0) / polygon.length
  const lng = polygon.reduce((s, p) => s + p.lng, 0) / polygon.length
  return { lat, lng }
}

// ─── Inner map (needs map context) ───────────────────────────────────────────

const LEAD_STATUS_COLOR = {
  New: '#4A90B8', Contacted: '#9B59B6', Pending: '#E6A817',
  'Demo Scheduled': '#E67E22', 'Proposal Sent': '#8B6914',
  Won: '#4CAF7D', Lost: '#D95F5F',
}

function MapContent({ territories, leads, customers, showLeads, showCustomers }) {
  const map = useMap()
  const mapsLib = useMapsLibrary('maps')
  const drawingLib = useMapsLibrary('drawing')
  const [selectedTerritory, setSelectedTerritory] = useState(null)
  const [drawing, setDrawing] = useState(false)
  const [drawingTarget, setDrawingTarget] = useState(null)

  // Draw territory polygons
  useEffect(() => {
    if (!mapsLib || !map) return
    const drawn = []
    territories.filter((t) => t.polygon?.length > 0).forEach((t) => {
      const color = STATUS_COLOR[t.status] ?? '#8B6914'
      const poly = new mapsLib.Polygon({
        paths: t.polygon,
        strokeColor: color, strokeOpacity: 0.8, strokeWeight: 2,
        fillColor: color, fillOpacity: 0.15, map,
      })
      poly.addListener('click', () => setSelectedTerritory(t))
      drawn.push(poly)
    })
    return () => drawn.forEach((p) => p.setMap(null))
  }, [mapsLib, map, territories])

  // Drawing manager
  useEffect(() => {
    if (!drawingLib || !map || !drawing) return
    const mgr = new drawingLib.DrawingManager({
      map,
      drawingMode: drawingLib.OverlayType.POLYGON,
      drawingControl: false,
      polygonOptions: {
        strokeColor: '#8B6914', strokeOpacity: 0.9, strokeWeight: 2,
        fillColor: '#8B6914', fillOpacity: 0.2, editable: true,
      },
    })
    const listener = mgr.addListener('polygoncomplete', async (polygon) => {
      const path = polygon.getPath().getArray().map((ll) => ({ lat: ll.lat(), lng: ll.lng() }))
      polygon.setMap(null)
      mgr.setMap(null)
      setDrawing(false)
      if (drawingTarget) {
        try {
          await updateDoc(doc(db, 'territories', drawingTarget), { polygon: path, updatedAt: serverTimestamp() })
        } catch (e) { console.error(e) }
        setDrawingTarget(null)
      }
    })
    return () => { listener.remove(); mgr.setMap(null) }
  }, [drawingLib, map, drawing, drawingTarget])

  return (
    <>
      {/* Territory label pins */}
      {territories.filter((t) => t.polygon?.length > 0).map((t) => {
        const center = centroid(t.polygon)
        if (!center) return null
        return (
          <AdvancedMarker key={`label-${t.id}`} position={center} onClick={() => setSelectedTerritory(t)}>
            <div className="bg-white border border-gray-200 rounded-lg px-2 py-1 shadow text-xs font-semibold text-[#1A1A1A] whitespace-nowrap cursor-pointer">
              {t.name}
            </div>
          </AdvancedMarker>
        )
      })}

      {/* Lead pins overlay */}
      {showLeads && leads.filter((l) => l.lat && l.lng).map((l) => (
        <AdvancedMarker key={`lead-${l.id}`} position={{ lat: l.lat, lng: l.lng }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: LEAD_STATUS_COLOR[l.status] ?? '#4A90B8', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} title={`${l.firstName ?? ''} ${l.lastName ?? ''}`.trim() || 'Lead'} />
        </AdvancedMarker>
      ))}

      {/* Customer pins overlay */}
      {showCustomers && customers.filter((c) => c.lat && c.lng).map((c) => (
        <AdvancedMarker key={`cust-${c.id}`} position={{ lat: c.lat, lng: c.lng }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#4CAF7D', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} title={`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.companyName || 'Customer'} />
        </AdvancedMarker>
      ))}

      {/* Info popup */}
      {selectedTerritory && (() => {
        const center = centroid(selectedTerritory.polygon)
        if (!center) return null
        return (
          <InfoWindow position={center} onCloseClick={() => setSelectedTerritory(null)}>
            <div className="min-w-[160px]">
              <p className="font-bold text-sm">{selectedTerritory.name}</p>
              {selectedTerritory.regionLabel && <p className="text-xs text-gray-500">{selectedTerritory.regionLabel}</p>}
              <p className="text-xs mt-1">Status: <strong>{selectedTerritory.status}</strong></p>
              {selectedTerritory.assignedRep && <p className="text-xs">Rep: {selectedTerritory.assignedRep}</p>}
              {selectedTerritory.statesCovered?.length > 0 && (
                <p className="text-xs mt-1">{selectedTerritory.statesCovered.join(', ')}</p>
              )}
              <button
                onClick={() => { setDrawingTarget(selectedTerritory.id); setDrawing(true); setSelectedTerritory(null) }}
                className="mt-2 w-full text-xs bg-[#8B6914] text-white rounded-md py-1.5 font-medium hover:bg-[#7a5c12] transition-colors">
                Redraw Shape
              </button>
            </div>
          </InfoWindow>
        )
      })()}

      {/* Draw shape selector */}
      {!drawing && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <select
            onChange={(e) => { if (e.target.value) { setDrawingTarget(e.target.value); setDrawing(true); e.target.value = '' } }}
            defaultValue=""
            className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm shadow-lg focus:outline-none focus:border-[#8B6914]"
          >
            <option value="" disabled>Draw territory shape…</option>
            {territories.map((t) => <option key={t.id} value={t.id}>{t.name}{t.polygon?.length ? ' (redraw)' : ''}</option>)}
          </select>
        </div>
      )}

      {drawing && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-[#8B6914] text-white rounded-xl px-4 py-2.5 text-sm shadow-lg flex items-center gap-3">
            <span>Click to draw polygon points — double-click to finish</span>
            <button onClick={() => { setDrawing(false); setDrawingTarget(null) }} className="text-white/70 hover:text-white text-xl leading-none">×</button>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TerritoryMap() {
  const navigate = useNavigate()
  const { territories, loading } = useTerritories()
  const [showLeads, setShowLeads] = useState(false)
  const [showCustomers, setShowCustomers] = useState(false)
  const [leads, setLeads] = useState([])
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    if (!showLeads) return
    const q = query(leadsCol, orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [showLeads])

  useEffect(() => {
    if (!showCustomers) return
    const q = query(customersCol, orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [showCustomers])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Controls bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-4 flex-wrap">
        <button onClick={() => navigate('/admin/territories')} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-sm">
          ← Territories
        </button>
        <h1 className="text-base font-bold text-[#1A1A1A]">Territory Map</h1>

        <div className="flex items-center gap-4 ml-auto">
          {Object.entries(STATUS_COLOR).map(([status, color]) => (
            <span key={status} className="flex items-center gap-1.5 text-xs text-[#9A9A9A]">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.7 }} />
              {status}
            </span>
          ))}
          <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
            <span className="text-xs text-[#9A9A9A] font-medium">Overlay:</span>
            <button onClick={() => setShowLeads((v) => !v)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${showLeads ? 'bg-[#4A90B8] text-white' : 'bg-gray-100 text-[#9A9A9A] hover:bg-gray-200'}`}>
              Leads
            </button>
            <button onClick={() => setShowCustomers((v) => !v)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${showCustomers ? 'bg-[#4CAF7D] text-white' : 'bg-gray-100 text-[#9A9A9A] hover:bg-gray-200'}`}>
              Customers
            </button>
          </div>
          <span className="text-xs text-[#9A9A9A]">
            {territories.filter((t) => t.polygon?.length > 0).length}/{territories.length} mapped
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center">
            <p className="text-sm text-[#9A9A9A] animate-pulse">Loading territories…</p>
          </div>
        )}
        <APIProvider apiKey={MAPS_API_KEY} libraries={['drawing']}>
          <Map
            mapId="crk-territory-map"
            defaultCenter={{ lat: 39.5, lng: -98.35 }}
            defaultZoom={5}
            gestureHandling="greedy"
            style={{ width: '100%', height: '100%' }}
          >
            <MapContent territories={territories} leads={leads} customers={customers} showLeads={showLeads} showCustomers={showCustomers} />
          </Map>
        </APIProvider>
      </div>
    </div>
  )
}
