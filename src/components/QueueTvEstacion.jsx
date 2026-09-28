// TV de una sola estación — UNA pantalla persistente con estados (2026-09-28), no subárboles
// que se desmontan: el fondo negro con manchas naranjas, el logo TF y el pie (línea blanca,
// "ESTACIÓN N", hora) viven arriba y nunca se desmontan; los estados hacen cross-fade y el
// logo se mueve de posición con transiciones CSS.
//
// Estados (los decide calcularEstadoEstacion en tvClock.js, pura y testeada):
//   off         box libre y nadie viene: TF grande al centro; cada ~30 s corre el Lottie del splash.
//   llegando    "Hola <nombre>": el logo se achica y sube. Box 1: `confirmando` apunta acá (con la
//               pista del sticker). Box N>1: el socio del box N-1 está en su transición. Y los
//               primeros 5 s de un socio recién entrado (con contador 5-4-3-2-1).
//   explicacion videos + modalidad. Los últimos 10 s → preparate.
//   preparate   "Preparate para empezar" con cuenta regresiva.
//   estacion    la estación corriendo (reloj de formato).
//   chau        transición: felicitaciones + a dónde avanzar.
// Sólo CSS (transiciones/keyframes); el reloj es setInterval, sin depender de rAF.
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import lottie from 'lottie-web/build/player/lottie_light'
import { supabase } from '../lib/supabase'
import { queueService } from '../services/queueService'
import { esPorTiempo, faseDelFormato, comoTexto, mmss, filasDelMinuto, prescripcionTexto } from '../lib/formatos'
import { explicacionDeFormato } from '../lib/modalidadTexto'
import { useCountdown, formatMMSS, calcularEstadoEstacion } from '../lib/tvClock'
import { exerciseMedia } from '../lib/exerciseMedia'
import logoLottie from '../assets/tf-logo.lottie.json'
import VideoEjercicio from './VideoEjercicio'

const GEIST = "'Geist', system-ui, -apple-system, sans-serif"
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
const NARANJA = '#F45F37'
const SUPERFICIE = 'rgba(255,255,255,0.07)'
const BORDE = 'rgba(255,255,255,0.16)'
const TENUE = 'rgba(255,255,255,0.65)'

const KEYFRAMES = `
@keyframes tvFadeIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes tvFadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes libreBlobA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(220px,120px) scale(1.25); } }
@keyframes libreBlobB { 0%,100% { transform: translate(0,0) scale(1.1); } 50% { transform: translate(-260px,-140px) scale(0.9); } }
@keyframes libreBlobC { 0%,100% { transform: translate(0,0) scale(0.9); } 50% { transform: translate(-160px,180px) scale(1.2); } }
@keyframes preparateNumIn { 0% { opacity: 0; transform: scale(0.55); filter: blur(22px); } 60% { opacity: 1; transform: scale(1.08); filter: blur(0); } 100% { opacity: 1; transform: scale(1); filter: blur(0); } }
@keyframes preparatePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
@keyframes holaTick { 0% { transform: scale(1.35); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }
`

// ── Reloj de formato (AMRAP/EMOM/Tabata) ─────────────────────────────────────────────────
function useFaseEstacion(estacionInicioIso, formato) {
  const [fase, setFase] = useState(null)
  useEffect(() => {
    if (!estacionInicioIso || !esPorTiempo(formato?.formato)) {
      setFase(null)
      return
    }
    const inicioMs = new Date(estacionInicioIso).getTime()
    const tick = () => {
      const transcurrido = Math.floor((Date.now() - inicioMs) / 1000)
      const f = faseDelFormato(Math.max(0, transcurrido), formato)
      setFase((prev) =>
        prev && f && prev.fase === f.fase && prev.ronda === f.ronda && prev.restanteSeg === f.restanteSeg ? prev : f
      )
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [estacionInicioIso, formato?.formato, formato?.rondas, formato?.trabajoSeg, formato?.descansoSeg])
  return fase
}

// Estado de la pantalla, recalculado cada 250 ms desde timestamps absolutos; sólo re-renderiza
// cuando algo visible cambia (estado o algún contador de segundos).
function useEstadoEstacion(args) {
  const ref = useRef(args)
  ref.current = args
  const [estado, setEstado] = useState(() => calcularEstadoEstacion(args))
  useEffect(() => {
    const tick = () =>
      setEstado((prev) => {
        const next = calcularEstadoEstacion({ ...ref.current, nowMs: Date.now() })
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      })
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [args.box, args.boxes, args.confirmando, args.line, args.posicion])
  return estado
}

// ── Fondo, logo y pie: persistentes ──────────────────────────────────────────────────────
function FondoNegro() {
  const blob = (estilo) => ({ position: 'absolute', borderRadius: '50%', background: NARANJA, filter: 'blur(160px)', ...estilo })
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000000', overflow: 'hidden' }}>
      <div style={blob({ width: 760, height: 760, left: -160, top: 620, opacity: 0.42, animation: 'libreBlobA 34s ease-in-out infinite' })} />
      <div style={blob({ width: 640, height: 640, right: -120, top: -140, opacity: 0.3, animation: 'libreBlobB 28s ease-in-out infinite' })} />
      <div style={blob({ width: 520, height: 520, left: 900, top: 520, opacity: 0.22, animation: 'libreBlobC 38s ease-in-out infinite' })} />
    </div>
  )
}

// Mismo vector que tecnofit-app/components/TFMark.tsx (viewBox 283.24 x 199.37).
function TFMarca({ width, color = '#ffffff' }) {
  return (
    <svg width={width} height={Math.round(width * (199.37 / 283.24))} viewBox="0 0 283.24 199.37" fill="none">
      <path
        d="M0,45.97h72.88l-36.54,153.4h67.22l54.96-73.69h71.31l16.41-45.99h-69.83c-17.92,0-32.84,4.27-47.29,16.2-6.32,5.21-11.72,11.44-16.28,18.25l-16.87,25.15,23.58-93.31h147.91L283.24,0H12.62L0,45.97Z"
        fill={color}
      />
    </svg>
  )
}

// El Lottie del splash es cuadrado (484×484) con la marca centrada al ~58.5% del ancho; el
// contenedor del logo es ese mismo cuadrado, así la marca estática y la animada coinciden.
const MARCA_RATIO = 0.585
const LOGO_POS = {
  // ancho de la MARCA, y centro (x, y) de la marca sobre el lienzo 1920×1080
  off: { marca: 640, cx: 960, cy: 470 },
  llegando: { marca: 300, cx: 960, cy: 215 },
  chico: { marca: 120, cx: 56 + 60, cy: 100 },
}

function LogoTF({ grupo }) {
  const p = LOGO_POS[grupo]
  const S = p.marca / MARCA_RATIO
  const cont = useRef(null)
  const anim = useRef(null)
  const [reproduciendo, setReproduciendo] = useState(false)

  const reproducir = useCallback(() => {
    if (anim.current || !cont.current) return
    setReproduciendo(true)
    // autoplay:false y avance manual con setInterval: lottie-web anima con requestAnimationFrame,
    // que Chrome pausa en una pestaña/ventana en segundo plano (una TV tapada quedaba con el
    // logo trabado en el cuadro 0) — el mismo problema que tenía el reloj.
    const a = lottie.loadAnimation({ container: cont.current, renderer: 'svg', loop: false, autoplay: false, animationData: logoLottie })
    const velocidad = window.__tvLogoSpeed || 1
    const inicio = Date.now()
    const total = a.totalFrames
    const id = window.setInterval(() => {
      const frame = ((Date.now() - inicio) / 1000) * logoLottie.fr * velocidad
      if (frame >= total - 1) {
        window.clearInterval(id)
        a.destroy()
        anim.current = null
        setReproduciendo(false)
      } else {
        a.goToAndStop(frame, true)
      }
    }, 33)
    a.__id = id
    anim.current = a
  }, [])

  useEffect(() => {
    window.__tvReproducirLogo = reproducir // gancho para verificar a mano
    return () => {
      delete window.__tvReproducirLogo
      if (anim.current) window.clearInterval(anim.current.__id)
      anim.current?.destroy()
      anim.current = null
    }
  }, [reproducir])

  // En reposo, el Lottie corre a los 3 s y después cada 30 s; entre pasadas se ve el TF estático.
  useEffect(() => {
    if (grupo !== 'off') return
    const t = setTimeout(reproducir, 3000)
    const i = setInterval(reproducir, 30000)
    return () => {
      clearTimeout(t)
      clearInterval(i)
    }
  }, [grupo, reproducir])

  const ease = '1s cubic-bezier(0.65, 0, 0.35, 1)'
  return (
    <div
      style={{
        position: 'absolute', zIndex: 20, width: S, height: S, left: p.cx - S / 2, top: p.cy - S / 2,
        transition: `left ${ease}, top ${ease}, width ${ease}, height ${ease}`,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: reproduciendo ? 0 : 1 }}>
        <TFMarca width={S * MARCA_RATIO} />
      </div>
      <div ref={cont} style={{ position: 'absolute', inset: 0, opacity: reproduciendo ? 1 : 0 }} />
    </div>
  )
}

// Slot derecho del pie: hoy la hora (HH:MM, 24 h, Buenos Aires). Componente aparte para poder
// cambiarlo por otra cosa sin tocar el resto.
function RelojPie() {
  const fmt = () =>
    new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })
  const [hora, setHora] = useState(fmt)
  useEffect(() => {
    const id = window.setInterval(() => setHora(fmt()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return <span style={{ fontFamily: MONO, fontSize: 44, color: '#ffffff' }}>{hora}</span>
}

function Pie({ posicion, slotDerecho = <RelojPie /> }) {
  return (
    <div style={{ position: 'absolute', zIndex: 20, left: 56, right: 56, bottom: 0, height: 120, borderTop: '2px solid #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: 4, color: '#ffffff' }}>ESTACIÓN {posicion}</span>
      {slotDerecho}
    </div>
  )
}

// Cross-fade entre estados: el estado que sale queda 700 ms encima desvaneciéndose (con su
// último cuadro) mientras el nuevo entra.
function Crossfade({ stateKey, children }) {
  const previo = useRef(null)
  const [saliente, setSaliente] = useState(null)
  useEffect(() => {
    const p = previo.current
    if (p && p.key !== stateKey) {
      setSaliente(p)
      const t = setTimeout(() => setSaliente(null), 700)
      return () => clearTimeout(t)
    }
  }, [stateKey])
  useEffect(() => {
    previo.current = { key: stateKey, node: children }
  })
  return (
    <>
      {saliente && (
        <div key={`out-${saliente.key}`} style={{ position: 'absolute', inset: 0, zIndex: 9, pointerEvents: 'none', animation: 'tvFadeOut 0.6s ease forwards' }}>
          {saliente.node}
        </div>
      )}
      <div key={stateKey} style={{ position: 'absolute', inset: 0, zIndex: 10, animation: 'tvFadeIn 0.7s ease both' }}>
        {children}
      </div>
    </>
  )
}

// ── Piezas de contenido (sobre negro) ────────────────────────────────────────────────────
function Pill({ children, tono = 'gris' }) {
  const estilos = {
    gris: { background: 'rgba(255,255,255,0.12)', color: '#ffffff' },
    naranja: { background: NARANJA, color: '#ffffff' },
  }
  return (
    <span style={{ padding: '10px 24px', borderRadius: 40, fontFamily: MONO, fontSize: 28, ...estilos[tono] }}>
      {children}
    </span>
  )
}

function Circulo({ n, activo }) {
  const c = activo ? NARANJA : '#ffffff'
  return (
    <span
      style={{
        width: 56, height: 56, borderRadius: '50%', border: `4px solid ${c}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 25, color: c, flexShrink: 0,
      }}
    >
      {n}
    </span>
  )
}

function MediaEjercicio({ fila, style }) {
  const media = exerciseMedia(fila, 'tv')
  if (media.kind === 'hosted') {
    return <VideoEjercicio src={media.src} poster={media.poster} recorte={media.recorte} style={{ width: '100%', height: '100%', objectFit: 'cover', ...media.style, ...style }} />
  }
  if (media.kind === 'image') {
    return <img src={media.src} alt={fila.name} style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }} />
  }
  return (
    <div style={{ width: 120, height: 120, borderRadius: 60, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="52" height="52" viewBox="0 0 24 24" fill="#ffffff"><path d="M8 5.5 19 12 8 18.5z" /></svg>
    </div>
  )
}

// El video es un bloque de aspecto fijo dimensionado por ALTURA dentro de un slot flex:1
// (letterbox: height:100% + maxWidth:100% + aspectRatio) — ver el historial de este archivo:
// dimensionarlo por ancho lo hacía desbordar y cortaba cabezas.
function TarjetaEjercicio({ n, fila, activa, total = 2 }) {
  const prescripcion = fila.sets_reps || prescripcionTexto({ segundos: fila.segundos_por_ejercicio })
  const aspectRatio = total <= 2 ? '16 / 9' : '16 / 10'
  return (
    <div
      style={{
        minWidth: 0, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', gap: 16,
        background: SUPERFICIE, border: `2px solid ${activa ? NARANJA : BORDE}`, borderRadius: 32, padding: 22,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <Circulo n={n} activo={activa} />
        <span style={{ fontSize: 28, fontWeight: 600, color: '#ffffff', lineHeight: 1.15, minWidth: 0 }}>{fila.name}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: '100%', maxWidth: '100%', aspectRatio, borderRadius: 24, background: '#0b0b0b', overflow: 'hidden' }}>
          <MediaEjercicio fila={fila} />
        </div>
      </div>
      {prescripcion && <div style={{ flexShrink: 0 }}><Pill>{prescripcion}</Pill></div>}
    </div>
  )
}

// N≥2 ejercicios en UNA fila (nunca dos: el alto real no alcanza y el video queda como un ícono).
function GrillaEjercicios({ exercises, activos }) {
  const total = exercises.length
  return (
    <div style={{ display: 'flex', gap: total <= 2 ? 32 : 24, flex: 1, minHeight: 0 }}>
      {exercises.map((f, i) => (
        <div key={f.exercise_order ?? i} style={{ flex: 1, minWidth: 0 }}>
          <TarjetaEjercicio n={i + 1} fila={f} activa={activos ? activos.has(f.exercise_order) : true} total={total} />
        </div>
      ))}
    </div>
  )
}

// Un solo ejercicio: video 16:9 grande a la izquierda (hasta ~1150×650), y a la derecha el
// nombre, la prescripción y (en explicación) la modalidad, en letra grande.
function EjercicioProtagonista({ fila, activa, modalidad }) {
  const prescripcion = fila.sets_reps || prescripcionTexto({ segundos: fila.segundos_por_ejercicio })
  return (
    <div style={{ display: 'flex', gap: 56, flex: 1, minHeight: 0, alignItems: 'center' }}>
      <div
        style={{
          height: '100%', maxHeight: 650, maxWidth: 1150, aspectRatio: '16 / 9', borderRadius: 40, background: '#0b0b0b',
          overflow: 'hidden', flexShrink: 0, border: activa ? `3px solid ${NARANJA}` : `2px solid ${BORDE}`,
        }}
      >
        <MediaEjercicio fila={fila} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {modalidad && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TENUE }}>{modalidad.titulo}</span>
            <span style={{ fontSize: 30, fontWeight: 500, color: '#ffffff', lineHeight: 1.3 }}>{modalidad.texto}</span>
          </div>
        )}
        <span style={{ fontSize: 84, fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>{fila.name}</span>
        {prescripcion && <div><Pill>{prescripcion}</Pill></div>}
      </div>
    </div>
  )
}

// Zona de contenido: deja libre el pie (120 px) y, a la izquierda del encabezado, el logo chico.
function ZonaContenido({ children }) {
  return (
    <div style={{ position: 'absolute', left: 56, right: 56, top: 40, bottom: 130, display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  )
}

function EncabezadoNegro({ nombre, pills = [], tiempoLabel, tiempoValor }) {
  return (
    <div style={{ height: 120, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 28, paddingLeft: 190 }}>
      <span style={{ fontSize: 64, fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap' }}>{nombre}</span>
      {pills.map((t) => <Pill key={t}>{t}</Pill>)}
      {tiempoValor && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 18 }}>
          <span style={{ fontSize: 26, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: TENUE }}>{tiempoLabel}</span>
          <span style={{ fontFamily: MONO, fontSize: 64, color: NARANJA }}>{tiempoValor}</span>
        </div>
      )}
    </div>
  )
}

// Franja de reloj de formato encima del pie (antes era la barra oscura de abajo).
function BarraFormato({ label, sublabel, mmssActual, mmssTotal }) {
  return (
    <div style={{ height: 130, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        {sublabel && <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 3, color: TENUE }}>{sublabel}</span>}
        <span style={{ fontSize: 48, fontWeight: 600, color: '#ffffff', lineHeight: 1.1 }}>{label}</span>
      </div>
      {mmssActual != null && (
        <div style={{ display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontFamily: MONO, fontSize: 110, color: '#ffffff', lineHeight: 1 }}>{mmssActual}</span>
          {mmssTotal != null && <span style={{ fontFamily: MONO, fontSize: 56, color: '#ffffff', opacity: 0.6, paddingBottom: 10 }}>/{mmssTotal}</span>}
        </div>
      )}
    </div>
  )
}

// ── Vistas por estado ────────────────────────────────────────────────────────────────────
function VistaLlegando({ estado }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 400, bottom: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center' }}>
      <span style={{ fontSize: 170, fontWeight: 600, color: '#ffffff', lineHeight: 1.05 }}>Hola {estado.nombre}</span>
      <span style={{ fontSize: 48, color: TENUE }}>Tu estación arranca en breve</span>
      {estado.sticker && (
        <span style={{ fontSize: 40, fontWeight: 600, color: NARANJA, marginTop: 10 }}>Apoyá el teléfono en el sticker</span>
      )}
      {estado.restanteHolaSeg != null && (
        <span
          key={estado.restanteHolaSeg}
          style={{
            marginTop: 18, width: 110, height: 110, borderRadius: 55, border: `5px solid ${NARANJA}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: MONO, fontSize: 56, color: NARANJA, animation: 'holaTick 0.5s ease-out',
          }}
        >
          {estado.restanteHolaSeg}
        </span>
      )}
    </div>
  )
}

function VistaPreparate({ segundos }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
      <span style={{ fontSize: 46, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: '#ffffff' }}>Preparate para empezar</span>
      <span
        key={segundos}
        style={{ fontFamily: MONO, fontSize: 440, fontWeight: 800, color: '#ffffff', lineHeight: 1, animation: 'preparateNumIn 0.7s cubic-bezier(0.16,1,0.3,1), preparatePulse 1s ease-in-out 0.35s' }}
      >
        {segundos}
      </span>
    </div>
  )
}

function VistaExplicacion({ box, estado }) {
  const exercises = box.ejercicios?.length ? box.ejercicios : box.ejercicio ? [box.ejercicio] : []
  const primero = box.ejercicio
  const { titulo, texto } = explicacionDeFormato(primero?.formato, {
    rondas: primero?.rondas,
    trabajoSeg: primero?.trabajo_seg,
    descansoSeg: primero?.descanso_seg,
    ejerciciosPorMinuto: primero?.ejercicios_por_minuto,
  })
  const restante = formatMMSS(estado.restanteExplicacionSeg)
  return (
    <ZonaContenido>
      <EncabezadoNegro nombre={box.socio} pills={['EXPLICACIÓN']} tiempoLabel="Empieza en" tiempoValor={restante} />
      <div style={{ flex: 1, minHeight: 0, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {exercises.length === 1 ? (
          <EjercicioProtagonista fila={exercises[0]} modalidad={{ titulo, texto }} />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, background: SUPERFICIE, border: `2px solid ${BORDE}`, borderRadius: 24, padding: '16px 30px', flexShrink: 0 }}>
              <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: TENUE, flexShrink: 0 }}>{titulo}</span>
              <span style={{ fontSize: 24, fontWeight: 500, color: '#ffffff' }}>{texto}</span>
            </div>
            <GrillaEjercicios exercises={exercises} activos={new Set()} />
          </>
        )}
      </div>
      <BarraFormato label="La estación arranca sola cuando termine este minuto." sublabel="EXPLICACIÓN" mmssActual={restante} mmssTotal={null} />
    </ZonaContenido>
  )
}

function VistaEstacion({ box, estado }) {
  const boxCountdown = formatMMSS(useCountdown(box.advances_at))
  const exercises = box.ejercicios?.length ? box.ejercicios : box.ejercicio ? [box.ejercicio] : []
  const primero = box.ejercicio
  const formato = primero
    ? { formato: primero.formato, rondas: primero.rondas, trabajoSeg: primero.trabajo_seg, descansoSeg: primero.descanso_seg }
    : null
  const fase = useFaseEstacion(estado.estacionInicioIso, formato)

  // EMOM agrupa por minuto (filasDelMinuto); el resto muestra la estación completa a la vez.
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
    <ZonaContenido>
      <EncabezadoNegro
        nombre={box.socio}
        pills={[comoTexto(primero?.formato, formato) || '', primero?.sets_reps].filter(Boolean)}
        tiempoLabel="Sale del box en"
        tiempoValor={boxCountdown}
      />
      <div style={{ flex: 1, minHeight: 0, paddingTop: 12, display: 'flex' }}>
        {delMinuto.length > 1 ? (
          <GrillaEjercicios exercises={delMinuto} />
        ) : exercises.length > 1 ? (
          <GrillaEjercicios exercises={exercises} activos={activos} />
        ) : primero ? (
          <EjercicioProtagonista fila={primero} activa />
        ) : (
          <span style={{ margin: 'auto', color: TENUE, fontSize: 28 }}>Entrenando</span>
        )}
      </div>
      <BarraFormato {...barra} />
    </ZonaContenido>
  )
}

function VistaChau({ box, boxes, posicion }) {
  const cuenta = formatMMSS(useCountdown(box.advances_at))
  const esUltima = posicion >= (boxes?.length || 0)
  return (
    <div style={{ position: 'absolute', left: 56, right: 56, top: 190, bottom: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, textAlign: 'center' }}>
      <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: NARANJA }}>¡Felicitaciones!</span>
      <span style={{ fontSize: 110, fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>Terminaste la estación {posicion}</span>
      <span style={{ fontSize: 60, fontWeight: 600, color: TENUE }}>
        {esUltima ? '¡Terminaste el circuito!' : `Avanzá a la estación ${posicion + 1}`}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 170, color: NARANJA, fontWeight: 800, lineHeight: 1.1 }}>{cuenta}</span>
    </div>
  )
}

function VistaEstado({ estado, box, boxes, posicion }) {
  switch (estado.estado) {
    case 'llegando': return <VistaLlegando estado={estado} />
    case 'preparate': return <VistaPreparate segundos={estado.restanteExplicacionSeg} />
    case 'explicacion': return <VistaExplicacion box={box} estado={estado} />
    case 'estacion': return <VistaEstacion box={box} estado={estado} />
    case 'chau': return <VistaChau box={box} boxes={boxes} posicion={posicion} />
    default: return null
  }
}

// overrideLineaId/overridePosicion: llegan por prop cuando la pantalla se abre por slug
// (TvPorSlug.jsx) en vez de por /lista-espera/tv/:lineaId/estacion/:posicion.
export default function QueueTvEstacion({ overrideLineaId, overridePosicion } = {}) {
  const { lineaId: lineaIdDeUrl, posicion: posicionDeUrl } = useParams()
  const lineaId = overrideLineaId ?? lineaIdDeUrl
  const posicion = overridePosicion ?? posicionDeUrl
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
  const estado = useEstadoEstacion({ box, boxes, confirmando: confirming, posicion: pos, line })
  const grupo = estado.estado === 'off' ? 'off' : estado.estado === 'llegando' ? 'llegando' : 'chico'

  return (
    <LienzoTv>
      <div style={{ position: 'relative', width: 1920, height: 1080, overflow: 'hidden', background: '#000000', color: '#ffffff', fontFamily: GEIST }}>
        <style>{KEYFRAMES}</style>
        <FondoNegro />
        <LogoTF grupo={grupo} />
        <Crossfade stateKey={estado.estado}>
          <VistaEstado estado={estado} box={box} boxes={boxes} posicion={pos} />
        </Crossfade>
        <Pie posicion={pos} />
        {!connected && (
          <div style={{ position: 'absolute', top: 16, right: 56, zIndex: 50, color: '#f59e0b', fontSize: 18, fontWeight: 600 }}>Reconectando…</div>
        )}
        {boxes.length > 0 && !box && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TENUE, fontSize: 32 }}>
            {`Esta línea no tiene box en la posición ${posicion}.`}
          </div>
        )}
      </div>
    </LienzoTv>
  )
}

// La pantalla está diseñada en 1920×1080 (el artboard aprobado) con tamaños fijos. En una TV
// 16:9 se ve igual; en un iPad o una tablet —que en la weekly quedaron como opción válida— se
// rompía: textos partidos, reloj cortado (prueba de la sala, 2026-09-24). Se escala el lienzo
// entero para que entre en cualquier pantalla, con bandas si la proporción no es 16:9.
function LienzoTv({ children }) {
  const [escala, setEscala] = useState(() => calcularEscala())
  useEffect(() => {
    const onResize = () => setEscala(calcularEscala())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 1920 * escala, height: 1080 * escala, position: 'relative' }}>
        <div style={{ width: 1920, height: 1080, transform: `scale(${escala})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function calcularEscala() {
  if (typeof window === 'undefined') return 1
  return Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
}
