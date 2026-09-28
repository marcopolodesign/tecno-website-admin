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
import { useCountdown, useBoxPhase, explicacionSegDeLinea, estacionSegDeLinea, formatMMSS } from '../lib/tvClock'
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
    const tick = () => {
      const transcurrido = Math.floor((Date.now() - inicioMs) / 1000)
      const f = faseDelFormato(Math.max(0, transcurrido), formato)
      setFase((prev) =>
        prev && f && prev.fase === f.fase && prev.ronda === f.ronda && prev.restanteSeg === f.restanteSeg
          ? prev
          : f
      )
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
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

// El video es un bloque de aspecto FIJO, nunca un rectángulo que se estira a lo que sobre
// del card (bug reportado 2026-09-28: con 1-2 ejercicios el video terminaba siendo una tira
// angosta ~5:1 que le cortaba la cabeza a la persona). `total` es cuántas tarjetas hay en la
// fila/grilla: con 2 entra un 16:9 completo por tarjeta; con 3+ (grilla de 2 columnas), al
// menos 16:10 para no repetir el mismo apriete. El caso de 1 solo ejercicio NO usa esta
// tarjeta — usa EjercicioProtagonista, con el video como bloque grande a la izquierda.
function MediaEjercicio({ fila, style }) {
  const media = exerciseMedia(fila, 'tv')
  if (media.kind === 'hosted') {
    return <VideoEjercicio src={media.src} poster={media.poster} recorte={media.recorte} style={{ width: '100%', height: '100%', objectFit: 'cover', ...media.style, ...style }} />
  }
  if (media.kind === 'image') {
    return <img src={media.src} alt={fila.name} style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }} />
  }
  return (
    <div style={{ width: 120, height: 120, borderRadius: 60, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="52" height="52" viewBox="0 0 24 24" fill="#ffffff"><path d="M8 5.5 19 12 8 18.5z" /></svg>
    </div>
  )
}

function TarjetaEjercicio({ n, fila, activa, total = 2 }) {
  const prescripcion = fila.sets_reps || prescripcionTexto({ segundos: fila.segundos_por_ejercicio })
  const aspectRatio = total <= 2 ? '16 / 9' : '16 / 10'
  return (
    <div
      style={{
        minWidth: 0, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', gap: 16,
        background: '#ffffff', border: `2px solid ${activa ? AZUL : '#e5e7eb'}`,
        borderRadius: 32, padding: 22,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <Circulo n={n} activo={activa} />
        <span style={{ fontSize: 28, fontWeight: 600, color: '#111827', lineHeight: 1.15, minWidth: 0 }}>{fila.name}</span>
      </div>
      {/* El slot ocupa lo que sobre del card (flex:1, altura real porque el card entero se
          estira a la altura de su fila/celda — ver GrillaEjercicios) y adentro el bloque de
          aspecto fijo se ajusta por ALTURA (height:100% + maxWidth:100%), nunca por ancho: así
          nunca se pasa del alto disponible ni fuerza al card a crecer más de la cuenta (el bug
          reportado 2026-09-28: con aspecto derivado del ANCHO, el video terminaba más alto que
          la fila y se superponía con la franja de modalidad de arriba). */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: '100%', maxWidth: '100%', aspectRatio, borderRadius: 24, background: '#f3f4f6', overflow: 'hidden' }}>
          <MediaEjercicio fila={fila} />
        </div>
      </div>
      {prescripcion && <div style={{ flexShrink: 0 }}><Pill>{prescripcion}</Pill></div>}
    </div>
  )
}

// Fila/grilla de N≥2 ejercicios: 2 entran en una fila (16:9 cada uno); 3+ arman una grilla
// de 2 columnas (16:10 cada uno) para no volver a angostar demasiado el video. `alignItems`/
// `alignContent` por default (stretch): cada card se estira a la altura real de su fila/celda,
// que es lo que le da al slot interno de TarjetaEjercicio una altura de verdad para calcular
// el bloque de aspecto fijo — con 'center' el card se quedaba con su altura de contenido y
// terminaba desbordando (ver comentario en TarjetaEjercicio).
function GrillaEjercicios({ exercises, activos }) {
  if (exercises.length === 2) {
    return (
      <div style={{ display: 'flex', gap: 32, flex: 1, minHeight: 0 }}>
        {exercises.map((f, i) => (
          <div key={f.exercise_order ?? i} style={{ flex: 1, minWidth: 0 }}>
            <TarjetaEjercicio n={i + 1} fila={f} activa={activos ? activos.has(f.exercise_order) : true} total={2} />
          </div>
        ))}
      </div>
    )
  }
  // gridTemplateRows explícito (2026-09-28): sin esto, una grilla con filas 'auto' les da a
  // los cards la altura MÍNIMA de su contenido (el slot flex:1 del video vale 0 en ese
  // cálculo), y el video terminaba como un ícono de 20px en vez de un bloque 16:10 — el
  // mismo problema de fondo que TarjetaEjercicio, acá a nivel fila.
  const columnas = 2
  const filas = Math.ceil(exercises.length / columnas)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: `repeat(${filas}, 1fr)`, gap: 24, flex: 1, minHeight: 0 }}>
      {exercises.map((f, i) => (
        <TarjetaEjercicio key={f.exercise_order ?? i} n={i + 1} fila={f} activa={activos ? activos.has(f.exercise_order) : true} total={exercises.length} />
      ))}
    </div>
  )
}

// Un solo ejercicio: el video es el protagonista de la pantalla — un bloque grande de 16:9
// a la izquierda (hasta ~1150×650, el número que pidió Mateo mirando el corte de cabeza en
// el bug), con el nombre, la prescripción y (en explicación) la modalidad en una columna a la
// derecha en letra grande. Nada de tira angosta: el bloque nunca se estira más allá de su
// propio 16:9, así que cover recorta apenas lo que el video ya trae de sobrante, no la
// cabeza de la persona.
function EjercicioProtagonista({ fila, activa, modalidad }) {
  const prescripcion = fila.sets_reps || prescripcionTexto({ segundos: fila.segundos_por_ejercicio })
  return (
    <div style={{ display: 'flex', gap: 56, flex: 1, minHeight: 0, alignItems: 'center' }}>
      <div
        style={{
          height: '100%', maxHeight: 650, maxWidth: 1150, aspectRatio: '16 / 9',
          borderRadius: 40, background: '#f3f4f6', overflow: 'hidden', flexShrink: 0,
          border: activa ? `3px solid ${AZUL}` : 'none',
        }}
      >
        <MediaEjercicio fila={fila} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
        {modalidad && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6b7280' }}>{modalidad.titulo}</span>
            <span style={{ fontSize: 30, fontWeight: 500, color: '#111827', lineHeight: 1.3 }}>{modalidad.texto}</span>
          </div>
        )}
        <span style={{ fontSize: 84, fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>{fila.name}</span>
        {prescripcion && <div><Pill>{prescripcion}</Pill></div>}
      </div>
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

// Countdown final de la explicación (2026-09-28): los últimos 10 segundos, la pantalla entera
// se tapa con un aviso de "preparáte" — nadie mira la tarjeta chica de un video cuando lo que
// importa es que en 3... 2... 1... arranca el reloj de la estación de verdad. El degradado
// reusa el mismo lenguaje que Fondo()/BarraInferior (elipse difuminada), en naranja de marca
// hacia oscuro. Cada número se anima con keyframes CSS (sin framer-motion): un remount por
// `key={segundos}` dispara la animación de entrada de nuevo en cada tick, como el contador
// "pensando" de Claude — un morph suave de blur/escala/opacidad, con un pulso sutil encima.
const PREPARATE_KEYFRAMES = `
@keyframes preparateNumIn {
  0% { opacity: 0; transform: scale(0.55); filter: blur(22px); }
  60% { opacity: 1; transform: scale(1.08); filter: blur(0px); }
  100% { opacity: 1; transform: scale(1); filter: blur(0px); }
}
@keyframes preparatePulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
@keyframes preparateBgPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.09); }
}
@keyframes preparateLabelIn {
  0% { opacity: 0; transform: translateY(16px); }
  100% { opacity: 1; transform: translateY(0); }
}
`

function PreparateOverlay({ segundos }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 30, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44,
      }}
    >
      <style>{PREPARATE_KEYFRAMES}</style>
      <div style={{ position: 'absolute', inset: 0, background: '#170b06' }} />
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id="prepbg" x="-500" y="-500" width="2920" height="2280" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="140" />
          </filter>
          <linearGradient id="prepbgg" x1="960" y1="0" x2="960" y2="1080" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={NARANJA} />
            <stop offset="0.55" stopColor="#7a2e1c" />
            <stop offset="1" stopColor="#170b06" />
          </linearGradient>
        </defs>
        <g filter="url(#prepbg)" style={{ transformOrigin: '1210px 780px' }}>
          <ellipse
            cx="0" cy="0" rx="900" ry="760"
            transform="translate(1210 780) rotate(-21)"
            fill="url(#prepbgg)"
            style={{ animation: 'preparateBgPulse 5s ease-in-out infinite', transformOrigin: 'center' }}
          />
        </g>
      </svg>
      <span
        style={{
          position: 'relative', fontSize: 46, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase',
          color: '#ffffff', animation: 'preparateLabelIn 0.6s ease-out',
        }}
      >
        Preparate para empezar
      </span>
      <span
        key={segundos}
        style={{
          position: 'relative', fontFamily: MONO, fontSize: 440, fontWeight: 800, color: '#ffffff', lineHeight: 1,
          animation: 'preparateNumIn 0.7s cubic-bezier(0.16,1,0.3,1), preparatePulse 1s ease-in-out 0.35s',
        }}
      >
        {segundos}
      </span>
    </div>
  )
}

function EstacionCorriendo({ box, line, posicion, boxes }) {
  const phase = useBoxPhase(box.entered_at, explicacionSegDeLinea(line), estacionSegDeLinea(line))
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
    // Últimos 10 segundos: se tapa todo con el aviso de "preparáte" (PreparateOverlay).
    const mostrarPreparate = phase.restanteExplicacionSeg > 0 && phase.restanteExplicacionSeg <= 10
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
        {/* Un solo ejercicio: el video es protagonista (EjercicioProtagonista, bloque 16:9
            grande a la izquierda + nombre/modalidad grande a la derecha — sin la franja de
            arriba, la modalidad va en la columna). Dos o más: franja compacta de modalidad +
            GrillaEjercicios, cada video en su propio bloque de aspecto fijo (2026-09-28: antes
            el video se estiraba a lo que sobrara del card y terminaba como una tira angosta
            que cortaba cabezas). */}
        {exercises.length === 1 ? (
          <div style={{ flex: 1, minHeight: 0, padding: '28px 0 246px', display: 'flex' }}>
            <EjercicioProtagonista fila={exercises[0]} modalidad={{ titulo, texto }} />
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, padding: '28px 0 246px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, background: '#ffffff', border: '2px solid #e5e7eb', borderRadius: 24, padding: '16px 30px', flexShrink: 0 }}>
              <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#6b7280', flexShrink: 0 }}>{titulo}</span>
              <span style={{ fontSize: 24, fontWeight: 500, color: '#111827' }}>{texto}</span>
            </div>
            <GrillaEjercicios exercises={exercises} activos={new Set()} />
          </div>
        )}
        <BarraInferior label="La estación arranca sola cuando termine este minuto." sublabel="EXPLICACIÓN" mmssActual={formatMMSS(phase.restanteExplicacionSeg)} mmssTotal={null} />
        {mostrarPreparate && <PreparateOverlay segundos={phase.restanteExplicacionSeg} />}
      </>
    )
  }

  if (phase.fase === 'transicion') {
    const totalBoxes = boxes?.length || 0
    const esUltima = posicion >= totalBoxes
    const siguiente = boxes?.find((b) => Number(b.line_position) === posicion + 1)
    const siguienteEjercicio = siguiente?.ejercicio?.name || siguiente?.ejercicios?.[0]?.name
    return (
      <>
        <EncabezadoEstacion
          posicion={posicion}
          rotuloDerecha={['TRANSICIÓN']}
          nombre={box.socio}
          boxCodigo={boxLabel(line?.line_number, posicion)}
          tiempoLabel={esUltima ? 'Termina en' : 'Avanza en'}
          tiempoValor={boxCountdown}
        />
        <div style={{ flex: 1, minHeight: 0, padding: '36px 0 246px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
              background: '#ffffff', border: `4px solid ${NARANJA}`, borderRadius: 48, padding: '56px 72px', maxWidth: 1500,
            }}
          >
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: NARANJA }}>¡Bien!</span>
            <span style={{ fontSize: 64, fontWeight: 700, color: '#111827', textAlign: 'center', lineHeight: 1.15 }}>
              Terminaste la estación {posicion}
            </span>
            <span style={{ fontSize: 42, fontWeight: 600, color: '#4b5563', textAlign: 'center', lineHeight: 1.3 }}>
              {esUltima
                ? '¡Terminaste el circuito!'
                : `Avanzá a la estación ${posicion + 1} — Box ${boxLabel(line?.line_number, posicion + 1)}${siguienteEjercicio ? ` · ${siguienteEjercicio}` : ''}`}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 100, color: NARANJA, fontWeight: 800 }}>{boxCountdown}</span>
          </div>
        </div>
        <BarraInferior
          label={esUltima ? '¡Terminaste el circuito!' : `Avanzá a la estación ${posicion + 1}`}
          sublabel="TRANSICIÓN"
          mmssActual={boxCountdown}
          mmssTotal={null}
        />
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
      <div style={{ flex: 1, minHeight: 0, padding: '36px 0 246px', display: 'flex' }}>
        {delMinuto.length > 1 ? (
          <GrillaEjercicios exercises={delMinuto} />
        ) : exercises.length > 1 ? (
          <GrillaEjercicios exercises={exercises} activos={activos} />
        ) : primero ? (
          <EjercicioProtagonista fila={primero} activa />
        ) : (
          <span style={{ margin: 'auto', color: '#6b7280', fontSize: 28 }}>Entrenando</span>
        )}
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
        rotuloDerecha={[posicion === 1 ? 'ESPERANDO A QUIEN CONFIRME' : 'LIBRE']}
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
              <span style={{ fontSize: 36, color: '#4b5563' }}>Apoyá el teléfono en el sticker del box {posicion} o confirmá en la app.</span>
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

  return (
    <LienzoTv>
    <div style={{ position: 'relative', width: 1920, height: 1080, overflow: 'hidden', background: '#F7F7FA', color: '#111827', fontFamily: GEIST }}>
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
          <EstacionCorriendo box={box} line={line} posicion={pos} boxes={boxes} />
        ) : (
          <EstacionLibre box={box} line={line} posicion={pos} confirming={confirming} />
        )}
      </div>
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
    <div style={{ position: 'fixed', inset: 0, background: '#F7F7FA', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
