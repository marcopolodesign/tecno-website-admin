// TV de sede — la lista de espera única, para toda la línea de cajas de la ubicación (no una
// por línea). A diferencia de QueueTv.jsx/QueueTvEstacion.jsx esta pantalla NO es pública:
// queue_entries y line_box_status están cerradas a `anon` por RLS (mismo motivo que documenta
// el comentario de arriba en QueueTv.jsx) y acá no hay un tv_linea() que las abra — no existe
// un RPC equivalente para "toda la sede" y agregar uno es un cambio de schema en
// tecnofit-supabase, fuera de este worktree (ver catchup/reporte de la tarea).
//
// La salida que no pide tocar Supabase: se abre logueada, como cualquier pantalla del admin —
// exactamente lo que ya sugería la consigna ("las TVs se abren logueadas en las computadoras
// del gym"). Reusa el cliente de Supabase ya autenticado y los mismos queueService que usa
// QueueMonitor, sin sidebar ni chrome del CRM alrededor.
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { isAuthenticated } from '../lib/supabase'
import { queueService, boxLabel } from '../services/queueService'
import { locationsService } from '../services/locationsService'
import { useCountdown, formatMMSS, explicacionSegDeLinea, estacionSegDeLinea } from '../lib/tvClock'

const GEIST = "'Geist', system-ui, -apple-system, sans-serif"
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const NARANJA = '#F45F37'
const ROTULO = '#E07C2C'

function nombreCorto(u) {
  if (!u) return 'Socio'
  const inicial = u.last_name ? `${u.last_name[0]}.` : ''
  return `${u.first_name ?? ''} ${inicial}`.trim() || 'Socio'
}

function minutosEsperando(createdAt) {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
}

function Fondo() {
  return (
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <filter id="tvsbg" x="-500" y="-500" width="2920" height="2280" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="134" />
        </filter>
        <linearGradient id="tvsbgg" x1="960" y1="60" x2="960" y2="1320" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F7F7FA" />
          <stop offset="0.470588" stopColor="#EDEDED" />
          <stop offset="0.929412" stopColor="#393939" />
        </linearGradient>
      </defs>
      <g filter="url(#tvsbg)">
        <ellipse cx="0" cy="0" rx="840" ry="700" transform="translate(1210 780) rotate(-21)" fill="url(#tvsbgg)" />
      </g>
    </svg>
  )
}

function FilaEspera({ entry, i }) {
  const confirmando = entry.status === 'confirming'
  const linea = entry.production_lines
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 28,
        background: '#ffffff',
        border: confirmando ? `4px solid ${NARANJA}` : '2px solid #e5e7eb',
        borderRadius: 36, padding: confirmando ? '24px 32px' : '16px 32px',
      }}
    >
      <span
        style={{
          width: confirmando ? 72 : 64, height: confirmando ? 72 : 64,
          borderRadius: confirmando ? 36 : '50%',
          border: `4px solid ${confirmando ? NARANJA : '#111827'}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: MONO, fontSize: confirmando ? 32 : 29, color: confirmando ? NARANJA : '#111827', flexShrink: 0,
        }}
      >
        {i + 1}
      </span>
      {confirmando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 46, fontWeight: 600, color: '#111827', lineHeight: 1.1 }}>{nombreCorto(entry.users)}</span>
          <span style={{ fontSize: 28, fontWeight: 500, color: NARANJA }}>
            Confirmá tu turno en la app{linea ? ` · entrás a ${linea.name}` : ''}
          </span>
        </div>
      ) : (
        <span style={{ fontSize: 42, fontWeight: 500, color: '#111827' }}>{nombreCorto(entry.users)}</span>
      )}
      <span style={{ marginLeft: 'auto', fontSize: 30, color: '#6b7280', flexShrink: 0 }}>
        {confirmando ? '' : `${minutosEsperando(entry.created_at)} min esperando`}
      </span>
    </div>
  )
}

function TarjetaLinea({ line, boxes }) {
  const box1 = boxes.find((b) => b.boxes?.line_position === 1)
  const box1Countdown = formatMMSS(useCountdown(box1?.status === 'occupied' ? box1.advances_at : null))
  const ocupados = boxes.filter((b) => b.status === 'occupied').length
  const proximoLugar = box1?.status === 'occupied' ? box1Countdown : 'Ahora'

  return (
    <div style={{ background: '#ffffff', border: '2px solid #e5e7eb', borderRadius: 36, padding: '30px 34px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 36, fontWeight: 600, color: '#111827' }}>{line.name}</span>
        <span style={{ fontSize: 28, color: '#6b7280' }}>{ocupados} de {boxes.length} en uso</span>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {boxes
          .slice()
          .sort((a, b) => (a.boxes?.line_position ?? 0) - (b.boxes?.line_position ?? 0))
          .map((b) => (
            <span
              key={b.id}
              style={{
                flex: 1, height: 78, borderRadius: 20,
                background: b.status === 'occupied' ? NARANJA : '#f3f4f6',
                color: b.status === 'occupied' ? '#ffffff' : '#6b7280',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: MONO, fontSize: 28,
              }}
            >
              {boxLabel(line.line_number, b.boxes?.line_position)}
            </span>
          ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 4 }}>
        <span style={{ fontSize: 24, color: '#6b7280' }}>Próximo lugar en</span>
        <span style={{ fontFamily: MONO, fontSize: 34, color: proximoLugar === 'Ahora' ? '#16a34a' : NARANJA, fontWeight: 700 }}>
          {proximoLugar}
        </span>
      </div>
    </div>
  )
}

function Reloj() {
  const [ahora, setAhora] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span style={{ fontFamily: MONO, fontSize: 32, color: '#4b5563' }}>{ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
}

function PantallaSede({ locationId }) {
  const [location, setLocation] = useState(null)
  const [lines, setLines] = useState([])
  const [boxesPorLinea, setBoxesPorLinea] = useState({})
  const [entries, setEntries] = useState([])
  const unsubsRef = useRef([])

  const refreshEntries = useCallback(async () => {
    try {
      const { data } = await queueService.getQueueForLocation(locationId)
      setEntries(data || [])
    } catch (err) {
      console.error('Error fetching sede queue:', err)
    }
  }, [locationId])

  const refreshBoxes = useCallback(async (lineId) => {
    try {
      const { data } = await queueService.getLineBoxStatus(lineId)
      setBoxesPorLinea((prev) => ({ ...prev, [lineId]: data || [] }))
    } catch (err) {
      console.error('Error fetching line box status:', err)
    }
  }, [])

  useEffect(() => {
    if (locationId) {
      locationsService.getLocation(locationId).then(({ data }) => setLocation(data)).catch(() => setLocation(null))
    }
  }, [locationId])

  useEffect(() => {
    queueService.getLines(locationId).then(({ data }) => setLines(data || []))
  }, [locationId])

  useEffect(() => {
    refreshEntries()
    const unsub = queueService.subscribeToLocationQueue(locationId, refreshEntries)
    return () => unsub?.()
  }, [locationId, refreshEntries])

  useEffect(() => {
    unsubsRef.current.forEach((fn) => fn?.())
    unsubsRef.current = lines.map((line) => {
      refreshBoxes(line.id)
      return queueService.subscribeToLine(line.id, () => refreshBoxes(line.id))
    })
    return () => unsubsRef.current.forEach((fn) => fn?.())
  }, [lines, refreshBoxes])

  // Duración estimada de una estación (explicación + estación real/demo), tomando la primera
  // línea como referencia — en la práctica todas las líneas de una sede corren la misma
  // configuración.
  const minutosEstacion = lines[0]
    ? Math.round((explicacionSegDeLinea(lines[0]) + estacionSegDeLinea(lines[0])) / 60)
    : null

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#F7F7FA', color: '#111827', fontFamily: GEIST }}>
      <Fondo />
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '56px 56px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
          <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: 1, color: ROTULO }}>LISTA DE ESPERA</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <span style={{ fontSize: 32, fontWeight: 500, color: '#4b5563' }}>{(location?.name || '').toUpperCase()}</span>
            <Reloj />
          </div>
        </div>
        <div style={{ marginTop: 22 }}>
          <span style={{ fontSize: 34, color: '#4b5563' }}>
            Una sola lista para toda la sede — el sistema te asigna a la línea que se libere primero.
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0, padding: '36px 0 246px' }}>
          <div style={{ display: 'flex', gap: 36, height: '100%' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
              {entries.length === 0 ? (
                <span style={{ margin: 'auto', color: '#9ca3af', fontSize: 36 }}>No hay nadie esperando.</span>
              ) : (
                entries.slice(0, 6).map((entry, i) => <FilaEspera key={entry.id} entry={entry} i={i} />)
              )}
              {entries.length > 6 && (
                <span style={{ fontSize: 30, color: '#6b7280', paddingLeft: 36 }}>y {entries.length - 6} personas más</span>
              )}
            </div>
            <div style={{ width: 660, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {lines.map((line) => (
                <TarjetaLinea key={line.id} line={line} boxes={boxesPorLinea[line.id] || []} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 210, overflow: 'hidden', background: '#111111' }}>
        <svg width="1920" height="210" viewBox="0 0 1920 210" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <filter id="tvsfg" x="-300" y="-300" width="2520" height="810" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="90" />
            </filter>
            <linearGradient id="tvsfgg" x1="0" y1="0" x2="1920" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#111111" />
              <stop offset="0.470588" stopColor="#111111" />
              <stop offset="0.929412" stopColor={NARANJA} />
            </linearGradient>
          </defs>
          <g filter="url(#tvsfg)">
            <ellipse cx="1520" cy="170" rx="720" ry="210" fill="url(#tvsfgg)" />
          </g>
        </svg>
        <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 56px', gap: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.7)' }}>ESPERA APROXIMADA</span>
            <span style={{ fontSize: 52, fontWeight: 600, color: '#ffffff', lineHeight: 1.1 }}>
              {minutosEstacion ? `Cada estación dura ${minutosEstacion} min` : 'Cada estación explica y después corre'}
            </span>
          </div>
          {minutosEstacion && (
            <div style={{ display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
              <span style={{ fontFamily: MONO, fontSize: 130, color: '#ffffff', lineHeight: 1 }}>{minutosEstacion}</span>
              <span style={{ fontFamily: MONO, fontSize: 64, color: '#ffffff', opacity: 0.6, paddingBottom: 14 }}>/min</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PideLogin() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#111111', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: GEIST, textAlign: 'center', padding: 40 }}>
      <div>
        <p style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>Esta pantalla necesita una sesión de staff</p>
        <p style={{ fontSize: 20, color: 'rgba(255,255,255,0.6)' }}>
          Iniciá sesión en el admin en esta misma computadora y volvé a abrir esta URL.
        </p>
        <a href="/" style={{ display: 'inline-block', marginTop: 24, color: NARANJA, fontSize: 20 }}>Ir a iniciar sesión</a>
      </div>
    </div>
  )
}

export default function QueueTvSede() {
  const { locationId: locationIdParam } = useParams()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [defaultLocationId, setDefaultLocationId] = useState(null)

  useEffect(() => {
    isAuthenticated().then((ok) => {
      setAuthed(ok)
      setChecking(false)
    })
  }, [])

  useEffect(() => {
    if (locationIdParam || !authed) return
    // Sin :locationId en la URL, cae a la primera sede activa — hoy hay una sola.
    locationsService.getLocations().then(({ data }) => {
      const activa = (data || []).find((l) => l.is_active) || data?.[0]
      setDefaultLocationId(activa?.id || null)
    })
  }, [locationIdParam, authed])

  if (checking) return null
  if (!authed) return <PideLogin />

  const locationId = locationIdParam || defaultLocationId
  if (!locationId) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#F7F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: GEIST }}>
        <span style={{ color: '#6b7280', fontSize: 24 }}>Cargando sede…</span>
      </div>
    )
  }

  return <PantallaSede locationId={locationId} />
}
