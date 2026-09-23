// TV de sede — la lista de espera única, para toda la ubicación (no una por línea).
// Pública, como QueueTv.jsx/QueueTvEstacion.jsx: lee todo por tv_sede(), un RPC
// SECURITY DEFINER granted a anon (mismo patrón que tv_linea) — nada de esto pasa por RLS,
// así que no hace falta sesión de staff ni chrome del CRM alrededor.
//
// Sin Realtime: postgres_changes está sujeto a RLS igual que las tablas, así que anon no
// recibiría nada — se refresca por polling cada 3s, que alcanza para una lista de espera.
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCountdown, formatMMSS, explicacionSegDeLinea, estacionSegDeLinea } from '../lib/tvClock'

const GEIST = "'Geist', system-ui, -apple-system, sans-serif"
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const NARANJA = '#F45F37'
const ROTULO = '#E07C2C'
const POLL_MS = 3000

function nombreCorto(u) {
  return u || 'Socio'
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

function FilaEspera({ entry, i, nombreLinea }) {
  const confirmando = entry.status === 'confirming'
  const confirmCountdown = formatMMSS(useCountdown(confirmando ? entry.confirm_deadline : null))
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
          <span style={{ fontSize: 46, fontWeight: 600, color: '#111827', lineHeight: 1.1 }}>{nombreCorto(entry.socio)}</span>
          <span style={{ fontSize: 28, fontWeight: 500, color: NARANJA }}>
            Confirmá tu turno en la app{nombreLinea ? ` · entrás a ${nombreLinea}` : ''}
          </span>
        </div>
      ) : (
        <span style={{ fontSize: 42, fontWeight: 500, color: '#111827' }}>{nombreCorto(entry.socio)}</span>
      )}
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
        {confirmando ? (
          <span style={{ fontFamily: MONO, fontSize: 44, color: NARANJA, fontWeight: 700 }}>{confirmCountdown}</span>
        ) : (
          <span style={{ fontSize: 30, color: '#6b7280' }}>{minutosEsperando(entry.created_at)} min esperando</span>
        )}
      </span>
    </div>
  )
}

function TarjetaLinea({ linea }) {
  const box1Countdown = formatMMSS(useCountdown(linea.box1?.status === 'occupied' ? linea.box1.advances_at : null))
  const proximoLugar = linea.box1?.status === 'occupied' ? box1Countdown : 'Ahora'

  return (
    <div style={{ background: '#ffffff', border: '2px solid #e5e7eb', borderRadius: 36, padding: '30px 34px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 36, fontWeight: 600, color: '#111827' }}>{linea.name}</span>
        <span style={{ fontSize: 28, color: '#6b7280' }}>{linea.ocupados} en uso</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 4 }}>
        <span style={{ fontSize: 26, color: '#6b7280' }}>Próximo lugar en</span>
        <span style={{ fontFamily: MONO, fontSize: 40, color: proximoLugar === 'Ahora' ? '#16a34a' : NARANJA, fontWeight: 700 }}>
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

export default function QueueTvSede() {
  const { locationId } = useParams()
  const [data, setData] = useState(null)
  const [connected, setConnected] = useState(true)
  const pollRef = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const { data: payload, error } = await supabase.rpc('tv_sede', { p_location_id: locationId || null })
      if (error) throw error
      setData(payload)
      setConnected(true)
    } catch (err) {
      console.error('Error refreshing sede TV:', err)
      setConnected(false)
    }
  }, [locationId])

  useEffect(() => {
    refresh()
    pollRef.current = setInterval(refresh, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [refresh])

  const sede = data?.sede
  const lineas = data?.lineas || []
  const fila = data?.fila || []
  // `fila` sólo trae line_number para quien está confirmando — el nombre de la línea sale de
  // buscarlo en `lineas`, que ya vino en el mismo payload.
  const nombreDeLinea = (lineNumber) => lineas.find((l) => l.line_number === lineNumber)?.name

  const minutosEstacion = lineas[0]
    ? Math.round((explicacionSegDeLinea(lineas[0]) + estacionSegDeLinea(lineas[0])) / 60)
    : null

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#F7F7FA', color: '#111827', fontFamily: GEIST }}>
      <Fondo />
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '56px 56px 0' }}>
        {!connected && (
          <div style={{ position: 'absolute', top: 16, right: 56, color: '#f59e0b', fontSize: 18, fontWeight: 600 }}>Reconectando…</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
          <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: 1, color: ROTULO }}>LISTA DE ESPERA</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <span style={{ fontSize: 32, fontWeight: 500, color: '#4b5563' }}>{(sede?.name || '').toUpperCase()}</span>
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
              {fila.length === 0 ? (
                <span style={{ margin: 'auto', color: '#9ca3af', fontSize: 36 }}>No hay nadie esperando.</span>
              ) : (
                fila.slice(0, 6).map((entry, i) => (
                  <FilaEspera key={entry.id} entry={entry} i={i} nombreLinea={nombreDeLinea(entry.line_number)} />
                ))
              )}
              {fila.length > 6 && (
                <span style={{ fontSize: 30, color: '#6b7280', paddingLeft: 36 }}>y {fila.length - 6} personas más</span>
              )}
            </div>
            <div style={{ width: 560, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {lineas.map((linea) => (
                <TarjetaLinea key={linea.id} linea={linea} />
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
