// TV de una sola estación — pantalla completa 1920×1080 para el box de UNA línea nada más,
// pensada para el diseño aprobado en tv-design/Estacion*.dc.html (Geist, fondo claro con el
// degradado de HomeBackground, barra inferior oscura). Reusa tv_linea() en vez de pedir un RPC
// nuevo: la línea entera ya viaja en un solo payload, así que basta con quedarse con la caja
// cuyo line_position matchea la URL — no hace falta tocar Supabase para esto.
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { queueService, boxLabel } from '../services/queueService'
import { esPorTiempo, faseDelFormato, comoTexto, mmss, filasDelMinuto, prescripcionTexto } from '../lib/formatos'
import { explicacionDeFormato } from '../lib/modalidadTexto'
import { useCountdown, useBoxPhase, explicacionSegDeLinea, formatMMSS } from '../lib/tvClock'
import { exerciseMedia } from '../lib/exerciseMedia'
import VideoEjercicio from './VideoEjercicio'

const GEIST = "'Geist', system-ui, -apple-system, sans-serif"
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const NARANJA = '#F45F37'
const ROTULO = '#E07C2C'
const AZUL = '#3b82f6'

// Mismo reloj de formato que el box angosto (BoxPanels.jsx), pero acá vive local: la pantalla
// de estación no necesita el resto de ese módulo (paneles chicos de columna) y así queda un
// solo archivo para leer de punta a punta.
function useFaseEstacion(estacionInicioIso, formato) {
  const [fase, setFase] = useState(null)
  useEffect(() => {
    if (!estacionInicioIso || !esPorTiempo(formato?.formato)) {
      setFase(null)
      return
    }
    const inicioMs = new Date(estacionInicioIso).getTime()
    let rafId
    const loop = () => {
      const transcurrido = Math.floor((Date.now() - inicioMs) / 1000)
      const f = faseDelFormato(Math.max(0, transcurrido), formato)
      setFase((prev) =>
        prev && f && prev.fase === f.fase && prev.ronda === f.ronda && prev.restanteSeg === f.restanteSeg
          ? prev
          : f
      )
      rafId = window.requestAnimationFrame(loop)
    }
    rafId = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(rafId)
  }, [estacionInicioIso, formato?.formato, formato?.rondas, formato?.trabajoSeg, formato?.descansoSeg])
  return fase
}

function Fondo() {
  return (
    <svg width="1920" height="1080" viewBox="0 0 1920 1080" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <filter id="tvbg" x="-500" y="-500" width="2920" height="2280" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="134" />
        </filter>
        <linearGradient id="tvbgg" x1="960" y1="60" x2="960" y2="1320" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F7F7FA" />
          <stop offset="0.470588" stopColor="#EDEDED" />
          <stop offset="0.929412" stopColor="#393939" />
        </linearGradient>
      </defs>
      <g filter="url(#tvbg)">
        <ellipse cx="0" cy="0" rx="840" ry="700" transform="translate(1210 780) rotate(-21)" fill="url(#tvbgg)" />
      </g>
    </svg>
  )
}

function BarraInferior({ label, sublabel, mmssActual, mmssTotal }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 210, overflow: 'hidden', background: '#111111' }}>
      <svg width="1920" height="210" viewBox="0 0 1920 210" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id="tvfg" x="-300" y="-300" width="2520" height="810" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="90" />
          </filter>
          <linearGradient id="tvfgg" x1="0" y1="0" x2="1920" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#111111" />
            <stop offset="0.470588" stopColor="#111111" />
            <stop offset="0.929412" stopColor={NARANJA} />
          </linearGradient>
        </defs>
        <g filter="url(#tvfg)">
          <ellipse cx="1520" cy="170" rx="720" ry="210" fill="url(#tvfgg)" />
        </g>
      </svg>
      <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 56px', gap: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          {sublabel && <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.7)' }}>{sublabel}</span>}
          <span style={{ fontSize: 52, fontWeight: 600, color: '#ffffff', lineHeight: 1.1 }}>{label}</span>
        </div>
        {mmssActual != null && (
          <div style={{ display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
            <span style={{ fontFamily: MONO, fontSize: 130, color: '#ffffff', lineHeight: 1 }}>{mmssActual}</span>
            {mmssTotal != null && (
              <span style={{ fontFamily: MONO, fontSize: 64, color: '#ffffff', opacity: 0.6, paddingBottom: 14 }}>/{mmssTotal}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Pill({ children, tono = 'gris' }) {
  const estilos = {
    gris: { background: '#f3f4f6', color: '#4b5563' },
    naranja: { background: NARANJA, color: '#ffffff' },
  }
  return (
    <span style={{ padding: '10px 24px', borderRadius: 40, fontFamily: MONO, fontSize: 28, ...estilos[tono] }}>
      {children}
    </span>
  )
}

function Circulo({ n, activo }) {
  return (
    <span
      style={{
        width: 56, height: 56, borderRadius: '50%',
        border: `4px solid ${activo ? NARANJA : '#111827'}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 25, color: activo ? NARANJA : '#111827', flexShrink: 0,
      }}
    >
      {n}
    </span>
  )
}

function TarjetaEjercicio({ n, fila, activa }) {
  const media = exerciseMedia(fila, 'tv')
  const prescripcion = fila.sets_reps || prescripcionTexto({ segundos: fila.segundos_por_ejercicio })
  return (
    <div
      style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18,
        background: '#ffffff', border: `2px solid ${activa ? AZUL : '#e5e7eb'}`,
        borderRadius: 36, padding: 26,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Circulo n={n} activo={activa} />
        <span style={{ fontSize: 36, fontWeight: 600, color: '#111827', lineHeight: 1.1, minWidth: 0 }}>{fila.name}</span>
      </div>
      <div style={{ width: '100%', height: 220, borderRadius: 28, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {media.kind === 'hosted' ? (
          <VideoEjercicio src={media.src} poster={media.poster} recorte={media.recorte} style={{ width: '100%', height: '100%', objectFit: 'cover', ...media.style }} />
        ) : media.kind === 'image' ? (
          <img src={media.src} alt={fila.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 120, height: 120, borderRadius: 60, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="#ffffff"><path d="M8 5.5 19 12 8 18.5z" /></svg>
          </div>
        )}
      </div>
      {prescripcion && <div><Pill>{prescripcion}</Pill></div>}
    </div>
  )
}

function EncabezadoEstacion({ posicion, rotuloDerecha, nombre, boxCodigo, tiempoLabel, tiempoValor }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
        <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: 1, color: ROTULO }}>ESTACIÓN {posicion}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {rotuloDerecha.map((t) => (
            <span key={t} style={{ fontSize: 32, fontWeight: 500, color: '#4b5563' }}>{t}</span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 22 }}>
        <span style={{ fontSize: 60, fontWeight: 600, color: nombre ? '#111827' : '#6b7280' }}>{nombre || 'Libre'}</span>
        <Pill>BOX {boxCodigo}</Pill>
        {tiempoValor && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 18 }}>
            <span style={{ fontSize: 26, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6b7280' }}>{tiempoLabel}</span>
            <span style={{ fontFamily: MONO, fontSize: 56, color: NARANJA }}>{tiempoValor}</span>
          </div>
        )}
      </div>
    </>
  )
}

function EstacionCorriendo({ box, line, posicion }) {
  const phase = useBoxPhase(box.entered_at, explicacionSegDeLinea(line))
  const boxCountdown = formatMMSS(useCountdown(box.advances_at))
  const exercises = box.ejercicios?.length ? box.ejercicios : box.ejercicio ? [box.ejercicio] : []
  const primero = box.ejercicio
  const formato = primero
    ? { formato: primero.formato, rondas: primero.rondas, trabajoSeg: primero.trabajo_seg, descansoSeg: primero.descanso_seg }
    : null
  const fase = useFaseEstacion(phase.fase === 'estacion' ? phase.estacionInicioIso : null, formato)

  if (phase.fase === 'explicacion') {
    const { titulo, texto } = explicacionDeFormato(primero?.formato, {
      rondas: primero?.rondas,
      trabajoSeg: primero?.trabajo_seg,
      descansoSeg: primero?.descanso_seg,
      ejerciciosPorMinuto: primero?.ejercicios_por_minuto,
    })
    return (
      <>
        <EncabezadoEstacion
          posicion={posicion}
          rotuloDerecha={['EXPLICACIÓN']}
          nombre={box.socio}
          boxCodigo={boxLabel(line?.line_number, posicion)}
          tiempoLabel="Empieza en"
          tiempoValor={formatMMSS(phase.restanteExplicacionSeg)}
        />
        <div style={{ flex: 1, minHeight: 0, padding: '36px 0 246px', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ background: '#ffffff', border: '2px solid #e5e7eb', borderRadius: 36, padding: '30px 36px' }}>
            <span style={{ fontSize: 28, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6b7280' }}>{titulo}</span>
            <p style={{ fontSize: 38, fontWeight: 500, color: '#111827', margin: '10px 0 0' }}>{texto}</p>
          </div>
          <div style={{ display: 'flex', gap: 28, flex: 1 }}>
            {exercises.map((f, i) => (
              <TarjetaEjercicio key={f.exercise_order ?? i} n={i + 1} fila={f} activa={false} />
            ))}
          </div>
        </div>
        <BarraInferior label="La estación arranca sola cuando termine este minuto." sublabel="EXPLICACIÓN" mmssActual={formatMMSS(phase.restanteExplicacionSeg)} mmssTotal={null} />
      </>
    )
  }

  // Estación corriendo. EMOM sabe agrupar por minuto (filasDelMinuto ya lo resuelve para el
  // box angosto); el resto de los formatos muestra la estación completa a la vez — igual que
  // Main.dc.html, que no rota entre los 4 ejercicios de un AMRAP. Ver canvas.json: la rotación
  // de Tabata por ronda quedó marcada ahí como pregunta abierta, no la inventamos acá.
  const porMinuto = primero?.formato === 'EMOM' ? Math.max(1, primero?.ejercicios_por_minuto || 1) : 1
  const delMinuto = primero?.formato === 'EMOM' && fase && !fase.terminado ? filasDelMinuto(exercises, porMinuto, fase.ronda) : exercises
  const activos = new Set(delMinuto.map((f) => f.exercise_order))

  let barra = { label: 'Vos manejás tus tiempos.', sublabel: null, mmssActual: null, mmssTotal: null }
  if (fase) {
    if (primero.formato === 'AMRAP' || primero.formato === 'A completar') {
      barra = { label: 'Las vueltas que entren', sublabel: null, mmssActual: mmss(fase.restanteSeg), mmssTotal: mmss(formato.trabajoSeg) }
    } else if (primero.formato === 'EMOM') {
      barra = { label: `Minuto ${fase.ronda} de ${formato.rondas}`, sublabel: null, mmssActual: mmss(fase.restanteSeg), mmssTotal: mmss(formato.trabajoSeg) }
    } else if (primero.formato === 'Tabata') {
      const totalFase = fase.fase === 'trabajo' ? formato.trabajoSeg : formato.descansoSeg
      barra = {
        label: fase.fase === 'trabajo' ? 'TRABAJO' : 'DESCANSO',
        sublabel: `RONDA ${fase.ronda} DE ${formato.rondas}`,
        mmssActual: mmss(fase.restanteSeg),
        mmssTotal: mmss(totalFase),
      }
    }
  }

  return (
    <>
      <EncabezadoEstacion
        posicion={posicion}
        rotuloDerecha={[comoTexto(primero?.formato, formato) || '', primero?.sets_reps].filter(Boolean)}
        nombre={box.socio}
        boxCodigo={boxLabel(line?.line_number, posicion)}
        tiempoLabel="Sale del box en"
        tiempoValor={boxCountdown}
      />
      <div style={{ flex: 1, minHeight: 0, padding: '36px 0 246px' }}>
        <div style={{ display: 'flex', gap: 28, height: '100%' }}>
          {delMinuto.length > 1 ? (
            delMinuto.map((f, i) => <TarjetaEjercicio key={f.exercise_order ?? i} n={i + 1} fila={f} activa />)
          ) : exercises.length > 1 ? (
            exercises.map((f, i) => (
              <TarjetaEjercicio key={f.exercise_order ?? i} n={i + 1} fila={f} activa={activos.has(f.exercise_order)} />
            ))
          ) : primero ? (
            <TarjetaEjercicio n={1} fila={primero} activa />
          ) : (
            <span style={{ margin: 'auto', color: '#6b7280', fontSize: 28 }}>Entrenando</span>
          )}
        </div>
      </div>
      <BarraInferior {...barra} />
    </>
  )
}

function EstacionLibre({ box, line, posicion, confirming }) {
  // El que confirma siempre entra al box 1 de la línea (el tick lo estampa así) — mostrar el
  // "te toca" en cualquier otro box mentiría sobre a dónde va esa persona.
  const teToca = posicion === 1 ? confirming : null
  return (
    <>
      <EncabezadoEstacion
        posicion={posicion}
        rotuloDerecha={['ESPERANDO A QUIEN CONFIRME']}
        nombre={null}
        boxCodigo={boxLabel(line?.line_number, posicion)}
      />
      <div style={{ flex: 1, minHeight: 0, padding: '36px 0 246px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {teToca ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 44, background: '#ffffff', border: `4px solid ${NARANJA}`, borderRadius: 48, padding: '48px 56px' }}>
            <span style={{ width: 132, height: 132, borderRadius: 66, border: `6px solid ${NARANJA}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 52, color: NARANJA, flexShrink: 0 }}>
              1
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
              <span style={{ fontSize: 28, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: NARANJA }}>Te toca</span>
              <span style={{ fontSize: 82, fontWeight: 600, color: '#111827', lineHeight: 1 }}>{teToca.socio}</span>
              <span style={{ fontSize: 36, color: '#4b5563' }}>Confirmá tu turno en la app y entrá al box {posicion}.</span>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 48, color: '#9ca3af' }}>Libre</span>
        )}
      </div>
      <BarraInferior label="Cada estación explica y después corre." sublabel="EN ESPERA" mmssActual={null} mmssTotal={null} />
    </>
  )
}

export default function QueueTvEstacion() {
  const { lineaId, posicion } = useParams()
  const pos = Number(posicion)
  const [line, setLine] = useState(null)
  const [boxes, setBoxes] = useState([])
  const [confirming, setConfirming] = useState(null)
  const [connected, setConnected] = useState(true)
  const unsubRef = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('tv_linea', { p_line_id: Number(lineaId) })
      if (error) throw error
      setLine(data?.linea ?? null)
      setBoxes(data?.boxes ?? [])
      setConfirming(data?.confirmando ?? null)
      setConnected(true)
    } catch (err) {
      console.error('Error refreshing station TV:', err)
      setConnected(false)
    }
  }, [lineaId])

  useEffect(() => {
    refresh()
    unsubRef.current = queueService.subscribeToLine(lineaId, refresh)
    const staleCheck = setInterval(refresh, 15000)
    return () => {
      unsubRef.current?.()
      clearInterval(staleCheck)
    }
  }, [lineaId, refresh])

  const box = boxes.find((b) => Number(b.line_position) === pos)

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#F7F7FA', color: '#111827', fontFamily: GEIST }}>
      <Fondo />
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '56px 56px 0' }}>
        {!connected && (
          <div style={{ position: 'absolute', top: 16, right: 56, color: '#f59e0b', fontSize: 18, fontWeight: 600 }}>Reconectando…</div>
        )}
        {!box ? (
          <div style={{ margin: 'auto', color: '#6b7280', fontSize: 32 }}>
            {boxes.length === 0 ? 'Cargando…' : `Esta línea no tiene box en la posición ${posicion}.`}
          </div>
        ) : box.status === 'occupied' ? (
          <EstacionCorriendo box={box} line={line} posicion={pos} />
        ) : (
          <EstacionLibre box={box} line={line} posicion={pos} confirming={confirming} />
        )}
      </div>
    </div>
  )
}
