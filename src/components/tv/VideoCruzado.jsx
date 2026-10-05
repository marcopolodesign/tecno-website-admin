// Video de ejercicio para las TVs con transiciones suaves (2026-09-30).
//
// Mateo: los cambios de video y de trabajo ↔ descanso se veían "muy, muy flojos": cada cambio
// desmontaba el <video> y montaba otro, con un cuadro negro o el póster hasta que cargaba.
// Acá los videos NO se remontan: se mantiene un pozo de elementos <video> (el que se ve + los
// próximos, precargados y reproduciéndose mudos y ocultos) y cambiar de ejercicio es sólo
// cruzar la opacidad (450 ms). El ejercicio nuevo no se muestra hasta que tiene su primer
// cuadro (loadeddata) — mientras tanto sigue el anterior, nunca un negro ni un póster.
import { useEffect, useMemo, useRef, useState } from 'react'
import { exerciseMedia } from '../../lib/exerciseMedia'
import VideoEjercicio from '../VideoEjercicio'
import { COLOR, RADIO } from './tokens'

const FADE_MS = 450
const ESPERA_MAX_MS = 2500 // si un video no carga, se muestra igual pasado este tiempo

export const claveEjercicio = (f) => (f ? `${f.exercise_order ?? ''}|${f.code ?? ''}|${f.name ?? ''}` : null)

export default function VideoCruzado({ fila, proximas = [], style }) {
  const claveActual = claveEjercicio(fila)
  const proximasKey = proximas.map(claveEjercicio).join('~')
  const contenedor = useRef(null)
  const [pozo, setPozo] = useState(() => [fila, ...proximas].filter(Boolean))
  const [listos, setListos] = useState({})
  const [visible, setVisibleRaw] = useState(null)
  const [previo, setPrevio] = useState(null) // el que recién salió: sigue opaco debajo hasta que termina el cruce
  const visibleRef = useRef(null)
  visibleRef.current = visible
  const setVisible = (nueva) => {
    if (nueva === visibleRef.current) return
    const anterior = visibleRef.current
    setPrevio(anterior)
    setVisibleRaw(nueva)
    setTimeout(() => setPrevio((p) => (p === anterior ? null : p)), FADE_MS + 80)
  }

  // El pozo: lo que se quiere (actual + próximas) y, un rato, el que recién se dejó de ver
  // (para poder cruzarlo hacia afuera sin cortarlo).
  useEffect(() => {
    const deseadas = [fila, ...proximas].filter(Boolean)
    const claves = new Set(deseadas.map(claveEjercicio))
    setPozo((prev) => {
      const saliente = prev.find((f) => claveEjercicio(f) === visibleRef.current && !claves.has(claveEjercicio(f)))
      return saliente ? [...deseadas, saliente] : deseadas
    })
    const t = setTimeout(() => setPozo((prev) => prev.filter((f) => claves.has(claveEjercicio(f)))), FADE_MS + 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveActual, proximasKey])

  // Se pasa a mostrar el ejercicio actual recién cuando tiene su primer cuadro.
  useEffect(() => {
    if (!claveActual) return undefined
    // imagen o placeholder: no hay nada que esperar
    if (exerciseMedia(fila, 'tv').kind !== 'hosted' || listos[claveActual]) {
      setVisible(claveActual)
      return undefined
    }
    const t = setTimeout(() => setVisible(claveActual), ESPERA_MAX_MS)
    return () => clearTimeout(t)
  }, [claveActual, listos])

  // Al pasar a verse NO se hace seek: un seek deja un cuadro negro mientras busca (se vio en la
  // grabación: un negro por cambio). El clip es un loop, así que entra por donde vaya; sólo
  // se asegura que esté reproduciendo.
  useEffect(() => {
    if (!visible || !contenedor.current) return
    const v = contenedor.current.querySelector(`video[data-clave="${CSS.escape(visible)}"]`)
    v?.play?.().catch(() => {})
  }, [visible])

  const marcar = (clave) => setListos((p) => (p[clave] ? p : { ...p, [clave]: true }))
  // El que entra aparece (0 -> 1) ENCIMA del que sale, que se queda opaco hasta que termina el
  // cruce y recién ahí se apaga. Si los dos bajaran/subieran a la vez, a mitad del cruce cada
  // uno estaría al 50% y se vería un bajón de brillo (un "negro" de medio cuadro).
  const capa = (clave) =>
    clave === visible
      ? { position: 'absolute', inset: 0, opacity: 1, zIndex: 2, transition: `opacity ${FADE_MS}ms ease` }
      : clave === previo
        ? { position: 'absolute', inset: 0, opacity: 1, zIndex: 1 }
        : { position: 'absolute', inset: 0, opacity: 0, zIndex: 1 }

  return (
    <div ref={contenedor} style={{ position: 'relative', width: '100%', height: '100%', background: COLOR.fondo, overflow: 'hidden', ...style }}>
      {pozo.map((f) => {
        const clave = claveEjercicio(f)
        const media = exerciseMedia(f, 'tv')
        if (media.kind === 'hosted') {
          return (
            <VideoEjercicio
              key={clave}
              data-clave={clave}
              src={media.src}
              recorte={media.recorte}
              preload="auto"
              onLoadedData={() => marcar(clave)}
              style={{ ...media.style, ...capa(clave) }}
            />
          )
        }
        if (media.kind === 'image') {
          return <img key={clave} src={media.src} alt={f.name} onLoad={() => marcar(clave)} style={{ ...capa(clave), width: '100%', height: '100%', objectFit: 'cover' }} />
        }
        // sin video propio: placeholder, listo de inmediato
        return (
          <div key={clave} style={{ ...capa(clave), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 120, height: 120, borderRadius: RADIO.pildora, background: COLOR.superficie, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill={COLOR.texto}><path d="M8 5.5 19 12 8 18.5z" /></svg>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Precarga (2026-09-30): deja en el caché del navegador los videos de la estación apenas se
// sabe cuáles son (incluso los del socio que está por llegar), para que el primer cuadro de
// cada uno esté disponible al instante cuando cambia el estado de la pantalla.
export function PrecargaVideos({ filas = [] }) {
  const srcs = useMemo(() => {
    const out = []
    for (const f of filas) {
      const m = exerciseMedia(f, 'tv')
      if (m.kind === 'hosted' && m.src && !out.includes(m.src)) out.push(m.src)
    }
    return out
  }, [filas])
  return (
    <div aria-hidden="true" style={{ position: 'absolute', width: 2, height: 2, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
      {srcs.map((s) => <video key={s} src={s} preload="auto" muted playsInline />)}
    </div>
  )
}
