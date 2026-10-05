// TV de sede — la lista de espera única, para toda la ubicación (no una por línea).
// Pública, como QueueTv.jsx/QueueTvEstacion.jsx: lee todo por tv_sede(), un RPC
// SECURITY DEFINER granted a anon (mismo patrón que tv_linea) — nada de esto pasa por RLS,
// así que no hace falta sesión de staff ni chrome del CRM alrededor.
//
// Sin Realtime: postgres_changes está sujeto a RLS igual que las tablas, así que anon no
// recibiría nada — se refresca por polling cada 3s, que alcanza para una lista de espera.
//
// Rediseño 2026-10-05 (Lista.dc): mismo sistema que las TVs de estación (tv/tokens.js) — fondo
// #050505 con manchas, superficies de vidrio, acento naranja sólo en texto y bordes.
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { queueService } from '../services/queueService'
import { serverNow } from '../lib/serverClock'
import { LienzoTv } from './tv/TvChrome'
import { useCountdown, formatMMSS, duracionBoxSegDeLinea } from '../lib/tvClock'
import { BORDE, BORDE_ACENTO_PX, COLOR, GEIST, MONO, RADIO, etiqueta, superficie } from './tv/tokens'
import { FondoManchas, KEYFRAMES, TFMarca, nombreLineaTv } from './tv/Piezas'

const POLL_MS = 3000
const BOXES_POR_LINEA = 5 // tv_sede no manda cuántos boxes tiene cada línea; las de Palermo son de 5

function nombreCorto(u) {
  return u || 'Socio'
}

// Segundos de espera estimados para cada persona de la fila, y para quien se sume ahora. Se
// reparte la fila entre las líneas: cada una libera su box 1 en `advances_at` (o ya está libre) y
// después cada persona lo ocupa una duración de box completa. Es una estimación: no ve los
// cuellos de botella de adelante (por eso se muestra con "~").
export function esperasEstimadas(fila = [], lineas = [], ahoraMs = serverNow()) {
  const slots = lineas.map((l) => ({
    t: l.box1?.status === 'occupied' && l.box1.advances_at ? Math.max(0, (new Date(l.box1.advances_at).getTime() - ahoraMs) / 1000) : 0,
    dur: duracionBoxSegDeLinea(l),
  }))
  if (!slots.length) return { porPersona: fila.map(() => null), nuevo: null }
  const tomar = () => {
    const s = slots.reduce((a, b) => (b.t < a.t ? b : a))
    const espera = s.t
    s.t += s.dur
    return espera
  }
  const porPersona = fila.map(() => tomar())
  return { porPersona, nuevo: tomar() }
}

const minutosTexto = (seg) => `~${Math.max(1, Math.round(seg / 60))} min`

function useAhora() {
  const [ahora, setAhora] = useState(() => serverNow())
  useEffect(() => {
    const id = setInterval(() => setAhora(serverNow()), 1000)
    return () => clearInterval(id)
  }, [])
  return ahora
}

function Reloj() {
  const ahora = useAhora()
  return (
    <span style={{ fontFamily: MONO, color: COLOR.texto }}>
      {new Date(ahora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })}
    </span>
  )
}

function FilaEspera({ entry, i, nombreLinea, espera }) {
  const confirmando = entry.status === 'confirming'
  const confirmCountdown = formatMMSS(useCountdown(confirmando ? entry.confirm_deadline : null))
  return (
    <div
      style={{
        ...superficie(RADIO.tarjeta), display: 'flex', alignItems: 'center', gap: 28, padding: '22px 28px',
        ...(confirmando ? { border: `${BORDE_ACENTO_PX}px solid ${COLOR.trabajo}` } : null),
      }}
    >
      <span
        style={{
          width: 84, height: 84, borderRadius: RADIO.mini, background: COLOR.pista, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 48, fontWeight: 800, flexShrink: 0,
        }}
      >
        {i + 1}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.05 }}>{nombreCorto(entry.socio)}</span>
        {confirmando && (
          <span style={{ fontSize: 26, color: COLOR.texto66 }}>
            Apoyá el teléfono en el box 1 o confirmá en la app
          </span>
        )}
      </div>
      {confirmando ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 4, color: COLOR.trabajo }}>
            {`TE TOCA${nombreLinea ? ` · ${nombreLineaTv(nombreLinea)}` : ''}`}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 38, color: COLOR.trabajo }}>{confirmCountdown}</span>
        </div>
      ) : (
        <span style={{ fontFamily: MONO, fontSize: 38, color: COLOR.texto66, flexShrink: 0 }}>
          {espera == null ? '' : espera <= 0 ? 'Ahora' : minutosTexto(espera)}
        </span>
      )}
    </div>
  )
}

// Una línea en el panel de la derecha: libre ahora / libre en M:SS y sus boxes.
function PanelLinea({ linea }) {
  const ocupadoBox1 = linea.box1?.status === 'occupied'
  const restante = formatMMSS(useCountdown(ocupadoBox1 ? linea.box1.advances_at : null))
  const total = Math.max(BOXES_POR_LINEA, linea.ocupados || 0)
  // box 1 con su estado real; del resto sólo se sabe cuántos están en uso en total
  let restantesOcupados = Math.max(0, (linea.ocupados || 0) - (ocupadoBox1 ? 1 : 0))
  const slots = Array.from({ length: total }, (_, i) => {
    if (i === 0) return ocupadoBox1 ? 'ocupado' : 'libre'
    if (restantesOcupados > 0) {
      restantesOcupados -= 1
      return 'ocupado'
    }
    return 'vacio'
  })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 40, fontWeight: 800 }}>{nombreLineaTv(linea.name)}</span>
        <span style={{ fontSize: 26, color: COLOR.texto66 }}>
          {ocupadoBox1 ? 'libre en ' : 'libre '}
          <span style={{ fontFamily: MONO, fontSize: 36, color: ocupadoBox1 ? COLOR.texto : COLOR.trabajo }}>{ocupadoBox1 ? restante : 'ahora'}</span>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`, gap: 10 }}>
        {slots.map((e, i) => (
          <div
            key={i}
            style={{
              height: 56, borderRadius: RADIO.mini, boxSizing: 'border-box',
              ...(e === 'ocupado' ? { background: 'rgba(245,245,244,0.8)' } : e === 'libre' ? { border: `2px dashed ${COLOR.trabajo}` } : { border: BORDE }),
            }}
          />
        ))}
      </div>
    </div>
  )
}

// overrideLocationId: llega por prop cuando la pantalla se abre por slug (TvPorSlug.jsx) en
// vez de por /lista-espera/tv/sede/:locationId.
export default function QueueTvSede({ overrideLocationId } = {}) {
  const { locationId: locationIdDeUrl } = useParams()
  const locationId = overrideLocationId ?? locationIdDeUrl
  const [data, setData] = useState(null)
  const [connected, setConnected] = useState(true)
  const pollRef = useRef(null)
  const ahora = useAhora()

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

  // Aviso en vivo (broadcast por sede) además del poll de 3 s.
  const sedeId = data?.sede?.id
  useEffect(() => {
    if (!sedeId) return undefined
    return queueService.subscribeToSala(sedeId, refresh)
  }, [sedeId, refresh])

  const sede = data?.sede
  const lineas = data?.lineas || []
  const fila = data?.fila || []
  // `fila` sólo trae line_number para quien está confirmando — el nombre de la línea sale de
  // buscarlo en `lineas`, que ya vino en el mismo payload.
  const nombreDeLinea = (lineNumber) => lineas.find((l) => l.line_number === lineNumber)?.name

  const { porPersona, nuevo } = esperasEstimadas(fila, lineas, ahora)
  // Con la fila larga se muestran 4 y "y N más" para que no se salga de la pantalla.
  const visibles = fila.length > 5 ? 4 : fila.length

  return (
    <LienzoTv>
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: COLOR.fondo, color: COLOR.texto, fontFamily: GEIST }}>
        <style>{KEYFRAMES}</style>
        <FondoManchas acento={COLOR.trabajo} />
        {!connected && (
          <div style={{ position: 'absolute', top: 16, right: 56, zIndex: 50, ...superficie(RADIO.pildora, { background: COLOR.vidrio }), padding: '8px 20px', fontSize: 26, color: COLOR.texto66 }}>
            Reconectando…
          </div>
        )}
        <div style={{ position: 'relative', height: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 640px', gap: 48, padding: 56, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              <TFMarca width={96} />
              <span style={{ fontSize: 72, fontWeight: 900, letterSpacing: -2 }}>Lista de espera</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflow: 'hidden' }}>
              {fila.length === 0 ? (
                <span style={{ marginTop: 40, color: COLOR.texto45, fontSize: 36 }}>No hay nadie esperando.</span>
              ) : (
                fila.slice(0, visibles).map((entry, i) => (
                  <FilaEspera key={entry.id} entry={entry} i={i} nombreLinea={nombreDeLinea(entry.line_number)} espera={porPersona[i]} />
                ))
              )}
              {fila.length > visibles && <span style={{ fontSize: 30, color: COLOR.texto66, paddingLeft: 28 }}>y {fila.length - visibles} personas más</span>}
            </div>

            <div style={{ ...superficie(RADIO.tarjeta), marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 24, padding: '24px 32px', flexShrink: 0 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="6" y="2" width="12" height="20" rx="2" />
                <path d="M2 8a6 6 0 0 1 0 8" />
                <path d="M22 8a6 6 0 0 1 0 8" />
              </svg>
              <span style={{ fontSize: 36, fontWeight: 700 }}>Anotate: apoyá el teléfono en el sticker de la entrada</span>
            </div>
          </div>

          <div style={{ ...superficie(RADIO.panel), display: 'flex', flexDirection: 'column', gap: 32, padding: 40 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={etiqueta(COLOR.texto66, 24, 6)}>Espera estimada</span>
              {nuevo == null ? null : nuevo <= 0 ? (
                <span style={{ fontFamily: MONO, fontSize: 120, fontWeight: 600, lineHeight: 1, letterSpacing: -6 }}>Ahora</span>
              ) : (
                <span style={{ fontFamily: MONO, fontSize: 180, fontWeight: 600, lineHeight: 0.9, letterSpacing: -9 }}>
                  {Math.max(1, Math.round(nuevo / 60))}
                  <span style={{ fontSize: 64, letterSpacing: 0, color: COLOR.texto66 }}> min</span>
                </span>
              )}
            </div>
            {lineas.map((linea) => <PanelLinea key={linea.id} linea={linea} />)}
            <div
              style={{
                marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: 26, color: COLOR.texto66,
                borderTop: BORDE, paddingTop: 20,
              }}
            >
              <span style={{ fontWeight: 700, letterSpacing: 4 }}>{(sede?.name || '').toUpperCase()}</span>
              <Reloj />
            </div>
          </div>
        </div>
      </div>
    </LienzoTv>
  )
}
