// TV de una sola estación — UNA pantalla persistente con estados (2026-09-28), no subárboles
// que se desmontan: el fondo (#050505 con manchas del color del estado) y el logo TF viven
// siempre; los estados hacen cross-fade y el logo se mueve de posición con transiciones CSS.
//
// Rediseño 2026-10-05 (spec "Sistema de las TVs"): todo sale de tv/tokens.js — acento sólo en
// texto, barras y bordes (nunca fondo pleno), superficies de vidrio, radios 32/24/16/píldora.
// REGLA DE MATEO: trabajo y descanso tienen EXACTAMENTE el mismo layout, nada cambia de lugar;
// sólo cambia el color del acento (manchas, etiqueta, barras).
//
// Estados (los decide calcularEstadoEstacion en tvClock.js, pura y testeada):
//   off         box libre y nadie viene: TF grande al centro; cada ~30 s corre el Lottie del splash.
//   llegando    "Hola <nombre>": el logo se achica y sube. Box 1: `confirmando` apunta acá (con la
//               pista del sticker). Box N>1: el socio del box N-1 está en su transición. Y los
//               primeros 5 s de un socio recién entrado (con contador 5-4-3-2-1).
//   explicacion videos + modalidad. Los últimos 10 s → preparate.
//   preparate   "Preparate para empezar" con cuenta regresiva 5-4-3-2-1.
//   estacion    la estación corriendo (reloj de formato): Tabata / AMRAP / EMOM / Series.
//   chau        transición: "Pasá a la estación N" (Cambio.dc).
//   resumen     fin de circuito en la última estación.
// Sólo CSS (transiciones/keyframes); el reloj es setInterval, sin depender de rAF.
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import lottie from 'lottie-web/build/player/lottie_light'
import { supabase } from '../lib/supabase'
import { queueService } from '../services/queueService'
import { esPorTiempo, faseDelFormato, comoTexto, mmss, filasDelMinuto, gruposDelMinuto, prescripcionTexto, tabataDeFase, ejercicioDeRonda, duracionSeg } from '../lib/formatos'
import { explicacionDeFormato } from '../lib/modalidadTexto'
import { useCountdown, formatMMSS, calcularEstadoEstacion, predecirBoxes, transicionSegDeLinea, estacionSegDeLinea, nombreDeSaludo } from '../lib/tvClock'
import { serverNow } from '../lib/serverClock'
import { LienzoTv, useLienzo } from './tv/TvChrome'
import { ChipsElementos, ChipElemento } from './tv/Elementos'
import logoLottie from '../assets/tf-logo.lottie.json'
import VideoCruzado, { PrecargaVideos } from './tv/VideoCruzado'
import { BORDE_ACENTO_PX, BORDE, COLOR, GEIST, MONO, RADIO, acentoDe, etiqueta, superficie, velo } from './tv/tokens'
import {
  Anima, BarraProgreso, BarrasRondas, Cronometro, Encabezado, FondoManchas, KEYFRAMES, NumeroEstacion, Pildora, TarjetaComoSeJuega, TarjetaSigue, TFMarca, nombreLineaTv,
} from './tv/Piezas'

// ── Reloj de formato (AMRAP/EMOM/Tabata) ─────────────────────────────────────────────────
// Devuelve la fase de faseDelFormato + `transcurridoSeg` (para la barra de progreso).
function useFaseEstacion(estacionInicioIso, formato) {
  const [fase, setFase] = useState(null)
  useEffect(() => {
    if (!estacionInicioIso || !esPorTiempo(formato?.formato)) {
      setFase(null)
      return
    }
    const inicioMs = new Date(estacionInicioIso).getTime()
    const tick = () => {
      const transcurrido = Math.floor((serverNow() - inicioMs) / 1000)
      const f = faseDelFormato(Math.max(0, transcurrido), formato)
      const nuevo = f && { ...f, transcurridoSeg: Math.max(0, transcurrido) }
      setFase((prev) =>
        prev && nuevo && prev.fase === nuevo.fase && prev.ronda === nuevo.ronda && prev.restanteSeg === nuevo.restanteSeg ? prev : nuevo
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
  const calcular = () => {
    const { box, boxes, confirmando, posicion, line } = ref.current
    const nowMs = serverNow()
    const pred = predecirBoxes(boxes, line, nowMs)
    const predBox = pred.find((b) => Number(b.line_position) === Number(posicion)) ?? box
    return { estado: calcularEstadoEstacion({ box, boxes, confirmando, posicion, line, nowMs }), box: predBox, boxes: pred }
  }
  // Firma de lo que se ve: sin cambios de firma no hay re-render (y no hay parpadeo cuando el
  // servidor confirma lo que la TV ya había predicho).
  const firma = (r) => JSON.stringify([r.estado, r.boxes.map((b) => [b.line_position, b.status, b.socio, b.entered_at, b.advances_at])])
  const [res, setRes] = useState(calcular)
  useEffect(() => {
    const tick = () =>
      setRes((prev) => {
        const next = calcular()
        return firma(prev) === firma(next) ? prev : next
      })
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [args.box, args.boxes, args.confirmando, args.line, args.posicion])
  return res
}

// ── Logo persistente ─────────────────────────────────────────────────────────────────────
// (el vector TFMarca vive en tv/Piezas.jsx)
// El Lottie del splash es cuadrado (484×484) con la marca centrada al ~58.5% del ancho; el
// contenedor del logo es ese mismo cuadrado, así la marca estática y la animada coinciden.
const MARCA_RATIO = 0.585
const LOGO_POS = {
  // ancho de la MARCA, y centro (x, y) de la marca sobre el lienzo 1920×1080
  off: { marca: 640, cx: 960, cy: 470 },
  llegando: { marca: 300, cx: 960, cy: 215 },
  // 'cambio' (chau / resumen): arriba a la derecha, 112 de ancho (Cambio.dc); en los demás
  // estados con contenido propio el logo se desvanece ('oculto', misma posición).
  cambio: { marca: 112, cx: null, cy: 64 + 40 },
  oculto: { marca: 112, cx: null, cy: 64 + 40 },
}

function LogoTF({ grupo }) {
  const { alto, ancho } = useLienzo()
  const base = LOGO_POS[grupo]
  // en el estado de reposo el logo vive en el centro de la pantalla: acompaña al alto fluido;
  // arriba a la derecha acompaña al ancho (margen derecho 96 como en Cambio.dc)
  const p = grupo === 'off' ? { ...base, cy: base.cy + (alto - 1080) / 2 } : { ...base, cx: base.cx ?? ancho - 96 - base.marca / 2 }
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
        opacity: grupo === 'oculto' ? 0 : 1, transition: `left ${ease}, top ${ease}, width ${ease}, height ${ease}, opacity 0.5s ease`, pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: reproduciendo ? 0 : 1 }}>
        <TFMarca width={S * MARCA_RATIO} />
      </div>
      <div ref={cont} style={{ position: 'absolute', inset: 0, opacity: reproduciendo ? 1 : 0 }} />
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

// ── Helpers de contenido ─────────────────────────────────────────────────────────────────
const capital = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)
const prescripcionDe = (f) => f?.sets_reps || prescripcionTexto({ segundos: f?.segundos_por_ejercicio })

// "10 por vuelta" / "10 reps" / "10" -> "10"; "30s" o cualquier otro texto se deja como está.
function repsDe(f) {
  const m = String(f?.sets_reps || '').match(/^\s*(\d+)(?:\s*(?:reps?|por vuelta|por ronda))?\s*$/i)
  return m ? m[1] : prescripcionDe(f)
}

// "4x8" -> { series: 4, reps: 8 }
function seriesDe(f) {
  const m = String(f?.sets_reps || '').match(/^\s*(\d+)\s*[x×]\s*(\d+)/i)
  return m ? { series: Number(m[1]), reps: Number(m[2]) } : null
}

const listaTexto = (nums) => (nums.length <= 1 ? String(nums[0] ?? '') : `${nums.slice(0, -1).join(', ')} y ${nums[nums.length - 1]}`)

// En qué rondas (Tabata, rota por ronda) o minutos (EMOM, rota por grupo) le toca a la fila `i`.
function turnosDe(i, { formato, ejercicios, rondas, porMinuto }) {
  const n = ejercicios.length
  if (n <= 1) return []
  const grupos = formato === 'EMOM' ? Math.ceil(n / Math.max(1, porMinuto)) : n
  const mio = formato === 'EMOM' ? Math.floor(i / Math.max(1, porMinuto)) : i
  const out = []
  for (let r = 1; r <= (rondas || 0); r++) if ((r - 1) % grupos === mio) out.push(r)
  return out
}

function tituloModalidad(p) {
  if (!p) return ''
  const min = Math.round((p.trabajo_seg || 0) / 60)
  switch (p.formato) {
    case 'Tabata': return `Tabata · ${p.rondas} rondas de ${p.trabajo_seg}/${p.descanso_seg}`
    case 'AMRAP': return `AMRAP · ${min} minutos`
    case 'A completar': return `A completar · ${min} minutos`
    case 'EMOM': return `EMOM · ${p.rondas} minutos`
    default: {
      const s = seriesDe(p)
      return s ? `Series · ${s.series} × ${s.reps}` : 'Series'
    }
  }
}

function pildoraFormato(p) {
  if (!p) return null
  if (esPorTiempo(p.formato)) {
    return comoTexto(p.formato, { rondas: p.rondas, trabajoSeg: p.trabajo_seg, descansoSeg: p.descanso_seg }).replace('×', ' × ').toUpperCase()
  }
  const s = seriesDe(p)
  return s ? `SERIES ${s.series} × ${s.reps}` : 'SERIES'
}

const ejerciciosDe = (box) => (box.ejercicios?.length ? box.ejercicios : box.ejercicio ? [box.ejercicio] : [])
const formatoDe = (p) => (p ? { formato: p.formato, rondas: p.rondas, trabajoSeg: p.trabajo_seg, descansoSeg: p.descanso_seg } : null)
const nombreLinea = (line) => nombreLineaTv(line?.name)

// ── Marcos de pantalla ───────────────────────────────────────────────────────────────────
function Marco({ children, estilo }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '48px 56px', boxSizing: 'border-box', gap: 32, ...estilo }}>
      {children}
    </div>
  )
}

// Número + "ESTACIÓN N · LÍNEA X" solos (off, hola, preparate).
function CabeceraBasica({ pos, line }) {
  return (
    <div style={{ position: 'absolute', left: 56, top: 48, display: 'flex', alignItems: 'center', gap: 24 }}>
      <NumeroEstacion n={pos} />
      <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase' }}>
        {`ESTACIÓN ${pos}${line?.name ? ` · ${nombreLinea(line)}` : ''}`}
      </span>
    </div>
  )
}

// ── Piezas del contenido de estación ─────────────────────────────────────────────────────
// Video grande (1180 de ancho) con radio 32: VideoCruzado dentro, velo y texto abajo. NO se
// remonta entre trabajo y descanso: sólo cambia el ejercicio (cruce de video) y los textos.
function MediaGrande({ fila, proximas, chips = [], numero, nombreSize = 92, pillSigue, acento }) {
  return (
    <div style={{ position: 'relative', borderRadius: RADIO.panel, overflow: 'hidden', border: BORDE, background: COLOR.fondo, minHeight: 0 }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <VideoCruzado fila={fila} proximas={proximas} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: velo(55, 0.88), pointerEvents: 'none', zIndex: 1 }} />
      <span
        style={{
          position: 'absolute', zIndex: 2, top: 32, left: 40, ...superficie(RADIO.pildora, { background: COLOR.vidrio, border: `${BORDE_ACENTO_PX}px solid ${acento}` }),
          padding: '10px 24px', fontSize: 26, fontWeight: 800, letterSpacing: 5, color: acento, opacity: pillSigue ? 1 : 0, transition: 'opacity 0.5s ease, color 0.5s ease, border-color 0.5s ease',
        }}
      >
        SIGUE
      </span>
      <div style={{ position: 'absolute', zIndex: 2, left: 40, right: 40, bottom: 36, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {chips.length > 0 && (
          <Anima k={chips.join('|')} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {chips.map((c) => <Pildora key={c} sobreVideo>{c}</Pildora>)}
          </Anima>
        )}
        <Anima k={fila.name} style={{ display: 'flex', alignItems: 'flex-end', gap: 28 }}>
          {numero != null && (
            <span style={{ fontFamily: MONO, fontSize: 120, fontWeight: 600, lineHeight: 0.85, color: acento, flexShrink: 0 }}>{numero}</span>
          )}
          <h1 style={{ margin: 0, fontSize: nombreSize, fontWeight: 800, lineHeight: 0.95, letterSpacing: -3 }}>{fila.name}</h1>
        </Anima>
      </div>
    </div>
  )
}

// Varios ejercicios a la vez (AMRAP / A completar / EMOM con varios por minuto / Series de
// varios): tarjetas de video en columnas, con el número (reps) en el acento y el nombre.
function GrillaCards({ filas, acento, valor = repsDe }) {
  const cols = filas.length <= 3 ? filas.length : Math.ceil(filas.length / 2)
  const nombreSize = cols <= 3 ? 38 : 32
  return (
    <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)', gap: 20 }}>
      {filas.map((f, i) => (
        <div key={f.exercise_order ?? i} style={{ position: 'relative', borderRadius: RADIO.panel, overflow: 'hidden', border: BORDE, background: COLOR.fondo, minHeight: 0 }}>
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <VideoCruzado fila={f} />
          </div>
          <div style={{ position: 'absolute', inset: 0, background: velo(45, 0.9), pointerEvents: 'none', zIndex: 1 }} />
          <div style={{ position: 'absolute', zIndex: 2, left: 24, right: 24, bottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 72, fontWeight: 600, lineHeight: 1, color: acento }}>{valor(f)}</span>
            <span style={{ fontSize: nombreSize, fontWeight: 800, lineHeight: 1.05 }}>{f.name}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Vistas por estado ────────────────────────────────────────────────────────────────────
function VistaOff({ pos, line }) {
  return <CabeceraBasica pos={pos} line={line} />
}

function VistaLlegando({ estado, box, pos, line, acento }) {
  const elementos = box?.elementos || []
  const hayEjercicios = Boolean(box?.ejercicios?.length || box?.ejercicio)
  return (
    <>
      <CabeceraBasica pos={pos} line={line} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 340, bottom: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, textAlign: 'center' }}>
        <span style={{ fontSize: 170, fontWeight: 800, letterSpacing: -5, lineHeight: 1.05 }}>Hola {estado.nombre}</span>
        <span style={{ fontSize: 48, color: COLOR.texto66 }}>{hayEjercicios ? 'Te presentamos tus ejercicios' : 'Tu estación arranca en breve'}</span>
        {elementos.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <ChipsElementos elementos={elementos} titulo="Juntá estos materiales" />
          </div>
        )}
        {estado.sticker && (
          <span style={{ fontSize: 40, fontWeight: 700, color: acento, marginTop: 10 }}>Apoyá el teléfono en el sticker</span>
        )}
        {estado.restanteHolaSeg != null && (
          <span
            key={estado.restanteHolaSeg}
            style={{
              marginTop: 12, width: 110, height: 110, borderRadius: RADIO.pildora, boxSizing: 'border-box', border: `${BORDE_ACENTO_PX}px solid ${acento}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 56, fontWeight: 600, color: acento, animation: 'holaTick 0.5s ease-out',
            }}
          >
            {estado.restanteHolaSeg}
          </span>
        )}
      </div>
    </>
  )
}

function VistaPreparate({ segundos, pos, line, acento }) {
  return (
    <>
      <CabeceraBasica pos={pos} line={line} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        <span style={{ ...etiqueta(acento, 46, 8) }}>Preparate para empezar</span>
        <span
          key={segundos}
          style={{ fontFamily: MONO, fontSize: 440, fontWeight: 600, color: COLOR.texto, lineHeight: 1, animation: 'preparateNumIn 0.7s cubic-bezier(0.16,1,0.3,1), preparatePulse 1s ease-in-out 0.35s' }}
        >
          {segundos}
        </span>
      </div>
    </>
  )
}

// Explicación (Explicacion.dc): HOLA + modalidad + "ARRANCÁS EN", los ejercicios en tarjetas
// grandes con su número y a qué rondas/minutos les toca, y los materiales abajo.
function VistaExplicacion({ box, estado, pos, line, acento }) {
  const exercises = ejerciciosDe(box)
  const primero = box.ejercicio || exercises[0]
  const { texto } = explicacionDeFormato(primero?.formato, {
    rondas: primero?.rondas,
    trabajoSeg: primero?.trabajo_seg,
    descansoSeg: primero?.descanso_seg,
    ejerciciosPorMinuto: primero?.ejercicios_por_minuto,
  })
  const ctx = { formato: primero?.formato, ejercicios: exercises, rondas: primero?.rondas, porMinuto: primero?.ejercicios_por_minuto || 1 }
  const cols = exercises.length <= 3 ? Math.max(1, exercises.length) : exercises.length === 4 ? 2 : 3
  const chico = cols >= 3
  const elementos = box.elementos || []
  return (
    <Marco>
      <Encabezado
        numero={pos}
        eyebrow={`Hola, ${nombreDeSaludo(box)}`}
        titulo={tituloModalidad(primero)}
        linea3={texto}
        derecha={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
            <span style={etiqueta(COLOR.texto66, 24, 6)}>Arrancás en</span>
            <Cronometro valor={formatMMSS(estado.restanteExplicacionSeg)} size={112} />
          </div>
        }
      />
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: 'minmax(0, 1fr)', gap: 24 }}>
        {exercises.map((f, i) => {
          const turnos = turnosDe(i, ctx)
          const prescripcion = capital(prescripcionDe(f))
          const sub = [turnos.length ? `${ctx.formato === 'EMOM' ? 'Minutos' : 'Rondas'} ${listaTexto(turnos)}` : null, prescripcion].filter(Boolean).join(' · ')
          return (
            <div key={f.exercise_order ?? i} style={{ position: 'relative', borderRadius: RADIO.panel, overflow: 'hidden', border: BORDE, background: COLOR.fondo, minHeight: 0 }}>
              <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                <VideoCruzado fila={f} />
              </div>
              <div style={{ position: 'absolute', inset: 0, background: velo(50, 0.88), pointerEvents: 'none', zIndex: 1 }} />
              {exercises.length > 1 && (
                <span
                  style={{
                    position: 'absolute', zIndex: 2, top: 28, left: 32, width: 64, height: 64, ...superficie(RADIO.mini, { background: COLOR.vidrio }),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 800,
                  }}
                >
                  {i + 1}
                </span>
              )}
              <div style={{ position: 'absolute', zIndex: 2, left: 32, right: 32, bottom: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: chico ? 44 : 60, fontWeight: 800, lineHeight: 1, letterSpacing: chico ? -1 : -2 }}>{f.name}</span>
                {sub && <span style={{ fontSize: 26, color: COLOR.texto66 }}>{sub}</span>}
              </div>
            </div>
          )
        })}
      </div>
      {elementos.length > 0 && (
        <div data-testid="franja-materiales" style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={etiqueta(COLOR.texto66, 24, 6)}>Juntá</span>
          {elementos.map((nombre) => <ChipElemento key={nombre} nombre={nombre} />)}
        </div>
      )}
    </Marco>
  )
}

// La estación corriendo. UNA escena para Tabata / AMRAP / EMOM / Series (Main, Descanso, Amrap,
// Emom y Series .dc): encabezado, video(s) a la izquierda en 1180, a la derecha etiqueta del estado
// + cronómetro + (barras | texto) + tarjeta inferior, y la barra de progreso de toda la estación.
// Trabajo y descanso comparten ESTE árbol: sólo cambian el acento, los textos y el ejercicio.
function VistaEstacion({ box, fase, pos, line }) {
  const exercises = ejerciciosDe(box)
  const primero = box.ejercicio || exercises[0]
  const tipo = primero?.formato
  const formato = formatoDe(primero)
  const porTiempo = esPorTiempo(tipo)
  const boxLeft = useCountdown(box.advances_at)
  const restanteEstacion = boxLeft == null ? null : Math.max(0, boxLeft - transicionSegDeLinea(line))
  // la fase llega con un tick de retraso en el primer cuadro: se arranca de la ronda 1
  const f = porTiempo
    ? fase || { fase: 'trabajo', ronda: 1, restanteSeg: formato.trabajoSeg, transcurridoSeg: 0, terminado: false }
    : null
  const termino = Boolean(f?.terminado)
  const rondas = formato?.rondas || 1
  const ctx = { formato: tipo, ejercicios: exercises, rondas, porMinuto: primero?.ejercicios_por_minuto || 1 }

  // ── qué va en cada lugar ──
  let acento = COLOR.trabajo
  let etiquetaEstado = 'TRABAJO'
  let valorReloj = ''
  let medio = null // izquierda
  let debajoDelReloj = null
  let tarjeta = null // abajo a la derecha
  let progreso = 0

  if (tipo === 'Tabata' && f) {
    const td = tabataDeFase(exercises, f, rondas)
    const enDescanso = f.fase === 'descanso'
    acento = acentoDe(enDescanso)
    etiquetaEstado = termino ? 'LISTO' : enDescanso ? 'DESCANSO' : 'TRABAJO'
    valorReloj = mmss(f.restanteSeg)
    // trabajo: el ejercicio de la ronda · descanso: el PRÓXIMO (con "SIGUE"); tras la última ronda se queda el actual
    const mostrado = enDescanso && td.siguiente ? td.siguiente : td.ejercicio || ejercicioDeRonda(exercises, termino ? rondas : f.ronda)
    const idx = Math.max(0, exercises.findIndex((x) => x.exercise_order === mostrado.exercise_order))
    const proximas = exercises.length > 1 ? [exercises[(idx + 1) % exercises.length], exercises[(idx + 2) % exercises.length]] : []
    medio = (
      <MediaGrande
        fila={mostrado}
        proximas={proximas.filter((x) => x && x.exercise_order !== mostrado.exercise_order)}
        chips={[capital(prescripcionDe(mostrado))].filter(Boolean)}
        pillSigue={enDescanso && Boolean(td.siguiente)}
        acento={acento}
      />
    )
    debajoDelReloj = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <BarrasRondas n={rondas} acento={acento} estado={(i) => (i < f.ronda ? 'hecha' : 'falta')} />
        <span style={{ fontSize: 28, color: COLOR.texto66 }}>
          {termino ? `${rondas} rondas completas` : `Ronda ${f.ronda} de ${rondas}${enDescanso ? ' terminada' : ''}`}
        </span>
      </div>
    )
    const despues = enDescanso ? (f.ronda + 1 < rondas ? ejercicioDeRonda(exercises, f.ronda + 2) : null) : f.ronda < rondas ? ejercicioDeRonda(exercises, f.ronda + 1) : null
    if (despues && !termino) tarjeta = <TarjetaSigue etiquetaTexto={enDescanso ? 'DESPUÉS' : 'SIGUE'} fila={despues} />
    progreso = f.transcurridoSeg / (duracionSeg(formato) || 1)
  } else if (tipo === 'EMOM' && f) {
    acento = COLOR.trabajo
    etiquetaEstado = termino ? 'LISTO' : `MINUTO ${f.ronda} DE ${rondas}`
    valorReloj = mmss(f.restanteSeg)
    const porMin = ctx.porMinuto
    const delMinuto = filasDelMinuto(exercises, porMin, termino ? rondas : f.ronda)
    medio =
      delMinuto.length > 1 ? (
        <GrillaCards filas={delMinuto} acento={acento} />
      ) : delMinuto[0] ? (
        <MediaGrande fila={delMinuto[0]} proximas={exercises.filter((x) => x.exercise_order !== delMinuto[0].exercise_order).slice(0, 2)} numero={repsDe(delMinuto[0])} acento={acento} />
      ) : null
    debajoDelReloj = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <BarrasRondas n={rondas} acento={acento} estado={(i) => (i < f.ronda - 1 || (termino && i < rondas) ? 'hecha' : i === f.ronda - 1 ? 'actual' : 'falta')} />
        <span style={{ fontSize: 28, color: COLOR.texto66 }}>Terminá las reps; lo que sobra del minuto es tu descanso</span>
      </div>
    )
    if (!termino && f.ronda < rondas) {
      const sig = filasDelMinuto(exercises, porMin, f.ronda + 1)
      if (sig.length) {
        tarjeta = <TarjetaSigue etiquetaTexto={`MINUTO ${f.ronda + 1}`} fila={sig[0]} texto={sig.map((x) => `${repsDe(x)} · ${x.name}`).join(' + ')} />
      }
    }
    progreso = f.transcurridoSeg / (duracionSeg(formato) || 1)
  } else if (porTiempo && f) {
    // AMRAP / A completar: todos los ejercicios con sus reps y UN reloj
    acento = COLOR.trabajo
    etiquetaEstado = termino ? 'LISTO' : 'TRABAJO'
    valorReloj = mmss(f.restanteSeg)
    medio = <GrillaCards filas={exercises} acento={acento} />
    debajoDelReloj = <span style={{ fontSize: 30, color: COLOR.texto66 }}>{`de ${mmss(formato.trabajoSeg)}`}</span>
    const texto =
      tipo === 'AMRAP'
        ? exercises.length > 1
          ? `Hacé las ${exercises.length} en orden y volvé a empezar. Todas las vueltas que entren.`
          : 'Repetí el ejercicio y volvé a empezar. Todas las vueltas que entren.'
        : explicacionDeFormato(tipo, { trabajoSeg: formato.trabajoSeg }).texto
    tarjeta = <TarjetaComoSeJuega texto={texto} />
    progreso = f.transcurridoSeg / (duracionSeg(formato) || 1)
  } else {
    // Series: a tu ritmo; el reloj es lo que queda de la estación
    acento = COLOR.trabajo
    etiquetaEstado = 'A TU RITMO'
    valorReloj = restanteEstacion == null ? '' : formatMMSS(restanteEstacion)
    const s = seriesDe(primero)
    medio =
      exercises.length > 1 ? (
        <GrillaCards filas={exercises} acento={acento} valor={(x) => prescripcionDe(x)} />
      ) : primero ? (
        <MediaGrande
          fila={primero}
          chips={[s ? `${s.series} series × ${s.reps} reps` : capital(prescripcionDe(primero))].filter(Boolean)}
          nombreSize={exercises[0]?.name?.length > 28 ? 84 : 92}
          acento={acento}
        />
      ) : (
        <div style={{ ...superficie(RADIO.panel), display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLOR.texto66, fontSize: 28 }}>Entrenando</div>
      )
    debajoDelReloj = <span style={{ fontSize: 30, color: COLOR.texto66 }}>quedan en la estación</span>
    tarjeta = (
      <TarjetaComoSeJuega
        texto={s ? `${s.series} series de ${s.reps}. Descansá entre series lo que necesites, sin pasarte del tiempo.` : explicacionDeFormato('Series').texto}
      />
    )
    const S = estacionSegDeLinea(line) || 1
    progreso = restanteEstacion == null ? 0 : 1 - restanteEstacion / S
  }

  return (
    <Marco>
      <Encabezado
        numero={pos}
        eyebrow={`ESTACIÓN ${pos}${line?.name ? ` · ${nombreLinea(line)}` : ''}`}
        subtitulo={box.socio}
        derecha={pildoraFormato(primero) ? <Pildora mono>{pildoraFormato(primero)}</Pildora> : null}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1180px minmax(0, 1fr)', gap: 48 }}>
        {medio}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minHeight: 0 }}>
          <Anima k={etiquetaEstado} style={{ ...{ fontSize: 34, fontWeight: 800, letterSpacing: 8, color: acento, transition: 'color 0.5s ease' } }}>
            {etiquetaEstado}
          </Anima>
          <Cronometro valor={valorReloj} />
          {debajoDelReloj}
          {tarjeta}
        </div>
      </div>
      <BarraProgreso fraccion={progreso} acento={acento} />
    </Marco>
  )
}

// Cambio de estación (Cambio.dc): fondo oscuro con manchas; el acento sólo en la flecha, la
// etiqueta y el contorno del próximo box. El logo (persistente) queda arriba a la derecha.
function VistaChau({ box, boxes, posicion, acento }) {
  const segundos = useCountdown(box.advances_at)
  const total = boxes?.length || 0
  const esUltima = posicion >= total
  // Al llegar a 0 el tick todavía puede tardar en mover al socio: no se muestra "0:00" clavado.
  const terminado = segundos != null && segundos <= 0
  return (
    <Marco estilo={{ padding: '64px 96px 72px', gap: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: 79 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 8, textTransform: 'uppercase', color: acento }}>{`¡Bien, ${nombreDeSaludo(box)}!`}</span>
          <span style={{ fontSize: 30, color: COLOR.texto66 }}>{`Terminaste la estación ${posicion}`}</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 64 }}>
        {esUltima ? (
          <span style={{ fontSize: 112, fontWeight: 900, lineHeight: 0.92, letterSpacing: -3 }}>
            ¡Terminaste<br />el circuito!
          </span>
        ) : (
          <>
            <span style={{ fontSize: 112, fontWeight: 900, lineHeight: 0.92, letterSpacing: -3 }}>
              Pasá a la<br />estación
            </span>
            <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke={acento} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12h15" />
              <path d="M13 6l6 6-6 6" />
            </svg>
            <span style={{ fontSize: 440, fontWeight: 900, lineHeight: 0.75, letterSpacing: -22 }}>{posicion + 1}</span>
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 48 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, total)}, minmax(0, 1fr))`, gap: 14, width: 900 }}>
          {Array.from({ length: total }, (_, i) => {
            const n = i + 1
            const hecho = n <= posicion
            const siguiente = !esUltima && n === posicion + 1
            return (
              <div
                key={n}
                style={{
                  height: 96, borderRadius: RADIO.tarjeta, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, fontWeight: 800,
                  ...(hecho
                    ? { background: COLOR.pista, color: COLOR.texto45 }
                    : siguiente
                      ? { background: COLOR.superficie, border: `${BORDE_ACENTO_PX}px solid ${acento}` }
                      : { border: BORDE, color: COLOR.texto66 }),
                }}
              >
                {n}
              </div>
            )
          })}
        </div>
        {!terminado && !esUltima && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={etiqueta(COLOR.texto66, 24, 6)}>Arranca en</span>
            <Cronometro valor={formatMMSS(segundos)} size={140} estilo={{ lineHeight: 1 }} />
          </div>
        )}
      </div>
    </Marco>
  )
}

// Fin de circuito en la última estación: lo que hizo en total. Mismos números que la app
// (minutos = desde que confirmó su entrada hasta que termina, estaciones = boxes de la línea);
// los kg salen de las cargas de la sesión y la línea se omite si no hay ninguna.
function VistaResumen({ estado, acento }) {
  const dato = (valor, unidad) => (
    <div style={{ ...superficie(RADIO.tarjeta), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '28px 56px' }}>
      <span style={{ fontFamily: MONO, fontSize: 150, fontWeight: 600, color: acento, lineHeight: 1, letterSpacing: -6 }}>{valor}</span>
      <span style={{ fontSize: 40, fontWeight: 600 }}>{unidad}</span>
    </div>
  )
  return (
    <Marco estilo={{ padding: '64px 96px 72px', gap: 0 }}>
      <div data-testid="resumen-circuito" style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 79 }}>
        <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 8, textTransform: 'uppercase', color: acento }}>¡Circuito completo!</span>
        <span style={{ fontSize: 30, color: COLOR.texto66 }}>Lo que hiciste hoy</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 48 }}>
        <span style={{ fontSize: 112, fontWeight: 900, lineHeight: 0.92, letterSpacing: -3 }}>{`Terminaste${estado.nombre ? `, ${estado.nombre}` : ''}`}</span>
        <div style={{ display: 'flex', gap: 24 }}>
          {estado.minutos != null && dato(estado.minutos, 'min entrenando')}
          {dato(estado.estaciones, estado.estaciones === 1 ? 'estación' : 'estaciones')}
          {estado.kg != null && dato(estado.kg.toLocaleString('es-AR'), 'kg movidos')}
        </div>
      </div>
    </Marco>
  )
}

function VistaEstado({ estado, box, boxes, posicion, line, fase, acento }) {
  switch (estado.estado) {
    case 'off': return <VistaOff pos={posicion} line={line} />
    case 'llegando': return <VistaLlegando estado={estado} box={box} pos={posicion} line={line} acento={acento} />
    case 'resumen': return <VistaResumen estado={estado} acento={acento} />
    case 'preparate': return <VistaPreparate segundos={estado.restanteExplicacionSeg} pos={posicion} line={line} acento={acento} />
    case 'explicacion': return <VistaExplicacion box={box} estado={estado} pos={posicion} line={line} acento={acento} />
    case 'estacion': return <VistaEstacion box={box} fase={fase} pos={posicion} line={line} />
    case 'chau': return <VistaChau box={box} boxes={boxes} posicion={posicion} acento={acento} />
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
  const boxesRef = useRef([])
  boxesRef.current = boxes

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
    const staleCheck = setInterval(refresh, 3000) // respaldo: el aviso en vivo (broadcast) llega al instante
    // (la suscripción al broadcast se hace aparte, cuando se conoce la sede)
    // Si algún box ocupado ya pasó su advances_at, el que lo mueve es el tick del servidor
    // (cada 10 s) y la TV se enteraría recién por el poll de 15 s: mientras haya un
    // vencido se vuelve a pedir tv_linea cada 2 s, hasta que el estado cambie.
    const vencidoCheck = setInterval(() => {
      const ahora = serverNow()
      if (boxesRef.current.some((b) => b.status === 'occupied' && b.advances_at && new Date(b.advances_at).getTime() < ahora)) refresh()
    }, 2000)
    return () => {
      unsubRef.current?.()
      clearInterval(staleCheck)
      clearInterval(vencidoCheck)
    }
  }, [lineaId, refresh])

  // Aviso en vivo por sede: refresca tv_linea al instante cuando cambia la cola o un box.
  const locationId = line?.location_id
  useEffect(() => {
    if (!locationId) return undefined
    return queueService.subscribeToSala(locationId, refresh)
  }, [locationId, refresh])

  const box = boxes.find((b) => Number(b.line_position) === pos)
  const { estado, box: boxVista, boxes: boxesVista } = useEstadoEstacion({ box, boxes, confirmando: confirming, posicion: pos, line })
  const grupo =
    estado.estado === 'off' ? 'off' : estado.estado === 'llegando' ? 'llegando' : estado.estado === 'chau' || estado.estado === 'resumen' ? 'cambio' : 'oculto'
  // El reloj de formato vive acá (y no en la vista) para que el fondo cambie de color con el descanso.
  const primeroBox = boxVista?.ejercicio || boxVista?.ejercicios?.[0]
  const fase = useFaseEstacion(estado.estado === 'estacion' ? estado.estacionInicioIso : null, formatoDe(primeroBox))
  const enDescanso = estado.estado === 'estacion' && primeroBox?.formato === 'Tabata' && fase?.fase === 'descanso'
  const acento = acentoDe(enDescanso)

  return (
    <LienzoTv>
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: COLOR.fondo, color: COLOR.texto, fontFamily: GEIST }}>
        <style>{KEYFRAMES}</style>
        <FondoManchas acento={acento} />
        <PrecargaVideos filas={boxVista?.ejercicios || []} />
        <LogoTF grupo={grupo} />
        <Crossfade stateKey={estado.estado}>
          <VistaEstado estado={estado} box={boxVista} boxes={boxesVista} posicion={pos} line={line} fase={fase} acento={acento} />
        </Crossfade>
        {!connected && (
          <div style={{ position: 'absolute', top: 16, right: 56, zIndex: 50 }}>
            <Pildora sobreVideo color={COLOR.texto66}>Reconectando…</Pildora>
          </div>
        )}
        {boxes.length > 0 && !box && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLOR.texto66, fontSize: 32 }}>
            {`Esta línea no tiene box en la posición ${posicion}.`}
          </div>
        )}
      </div>
    </LienzoTv>
  )
}
