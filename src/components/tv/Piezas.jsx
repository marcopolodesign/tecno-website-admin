// Piezas visuales compartidas por las TVs (estación y sede), todas hechas con tokens.js.
import { useState } from 'react'
import { exerciseMedia } from '../../lib/exerciseMedia'
import { BORDE, COLOR, GEIST, KEYFRAMES, MONO, RADIO, UN_VIDEO, etiqueta, superficie } from './tokens'
import Grilla from './Grilla'

export { KEYFRAMES }

// Las teles de la sala (Samsung Tizen, Chrome 63) no llegan a dibujar un `filter: blur(160px)` sobre un
// círculo de 760 px animado: lo descartan y el fondo queda negro. Ahí la mancha es un degradé radial
// del mismo tamaño aparente (difuminado incluido), que cualquier navegador pinta sin GPU.
const TV_VIEJA = (() => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const chrome = /Chrome\/(\d+)/.exec(ua)
  return /SMART-TV|Tizen|Web0S/i.test(ua) || (chrome && Number(chrome[1]) < 90)
})()

const BLUR = 160
const rgba = (hex, a) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// Fondo #050505 con las tres manchas difuminadas del color del ESTADO (trabajo / descanso).
export function FondoManchas({ acento = COLOR.trabajo }) {
  const blob = ({ width, height, left, right, top, ...resto }) => {
    if (!TV_VIEJA) {
      return { position: 'absolute', borderRadius: '50%', background: acento, filter: `blur(${BLUR}px)`, transition: 'background 0.8s ease', width, height, left, right, top, ...resto }
    }
    // El degradé cubre el círculo más lo que se desparrama el blur (~2,5 σ por lado), con la curva de
    // un círculo difuminado: pleno al centro, la mitad en el borde original, nada al final.
    const pad = BLUR * 2.5
    const borde = Math.round((width / 2 / (width / 2 + pad)) * 100)
    return {
      position: 'absolute', width: width + pad * 2, height: height + pad * 2,
      left: left != null ? left - pad : undefined, right: right != null ? right - pad : undefined, top: top - pad,
      background: `radial-gradient(closest-side, ${rgba(acento, 1)} 0%, ${rgba(acento, 0.92)} ${Math.round(borde * 0.55)}%, ${rgba(acento, 0.5)} ${borde}%, ${rgba(acento, 0.12)} ${Math.round(borde + (100 - borde) * 0.55)}%, ${rgba(acento, 0)} 100%)`,
      ...resto,
    }
  }
  return (
    <div data-fondo-manchas="1" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: COLOR.fondo, overflow: 'hidden' }}>
      <div style={blob({ width: 760, height: 760, left: -160, top: 620, opacity: 0.42, animation: 'libreBlobA 34s ease-in-out infinite' })} />
      <div style={blob({ width: 640, height: 640, right: -120, top: -140, opacity: 0.3, animation: 'libreBlobB 28s ease-in-out infinite' })} />
      <div style={blob({ width: 520, height: 520, left: 900, top: 520, opacity: 0.18, animation: 'libreBlobC 38s ease-in-out infinite' })} />
    </div>
  )
}

// Mismo vector que tecnofit-app/components/TFMark.tsx (viewBox 283.24 x 199.37).
export function TFMarca({ width, color = COLOR.texto }) {
  return (
    <svg width={width} height={Math.round(width * (199.37 / 283.24))} viewBox="0 0 283.24 199.37" fill="none" aria-label="TecnoFit">
      <path
        d="M0,45.97h72.88l-36.54,153.4h67.22l54.96-73.69h71.31l16.41-45.99h-69.83c-17.92,0-32.84,4.27-47.29,16.2-6.32,5.21-11.72,11.44-16.28,18.25l-16.87,25.15,23.58-93.31h147.91L283.24,0H12.62L0,45.97Z"
        fill={color}
      />
    </svg>
  )
}

// "LINEA A" (así está cargado en la base) se muestra como "LÍNEA A".
export const nombreLineaTv = (nombre) => String(nombre || '').toUpperCase().replace(/^LINEA\b/, 'LÍNEA')

// Texto que entra con un deslizamiento suave cada vez que cambia `k`.
export function Anima({ k, children, style, ...resto }) {
  return <div key={k} {...resto} style={{ animation: 'tvTextoIn 0.42s cubic-bezier(0.16, 1, 0.3, 1) both', ...style }}>{children}</div>
}

// Píldora de vidrio. `sobreVideo` la oscurece un poco para que se lea encima de la imagen.
export function Pildora({ children, mono = false, sobreVideo = false, color = COLOR.texto, borde, estilo }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 12, borderRadius: RADIO.pildora, boxSizing: 'border-box',
        background: sobreVideo ? COLOR.vidrio : COLOR.superficie, border: borde || BORDE, color,
        padding: mono ? '12px 28px' : sobreVideo ? '8px 20px' : '10px 24px',
        fontFamily: mono ? MONO : GEIST, fontSize: mono ? 28 : sobreVideo ? 26 : 28, fontWeight: mono ? 500 : 600,
        whiteSpace: 'nowrap', ...estilo,
      }}
    >
      {children}
    </span>
  )
}

// Número de la estación: cuadrado de vidrio, radio 24. El de la TV pequeña es 64 con radio 20 en el
// mockup de la imagen; acá el radio es siempre un token.
export function NumeroEstacion({ n, size = 112, fontSize = 80, letterSpacing = -3, estilo }) {
  return (
    <div
      style={{
        ...superficie(RADIO.tarjeta), width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize, fontWeight: 800, letterSpacing, ...estilo,
      }}
    >
      {n}
    </div>
  )
}

// Encabezado de las pantallas con estación: número + dos o tres líneas + algo a la derecha.
export function Encabezado({ numero, eyebrow, titulo, subtitulo, linea3, derecha, eyebrowColor = COLOR.texto, persona }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
      <NumeroEstacion n={numero} />
      {persona && <Avatar url={persona.avatar_url} iniciales={persona.iniciales} size={112} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color: eyebrowColor }}>{eyebrow}</span>
        {titulo && <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1, lineHeight: 1.15 }}>{titulo}</span>}
        {subtitulo && <span style={{ fontSize: 26, color: COLOR.texto66 }}>{subtitulo}</span>}
        {linea3 && <span style={{ fontSize: 26, color: COLOR.texto66, lineHeight: 1.25 }}>{linea3}</span>}
      </div>
      {derecha}
    </div>
  )
}

// Cronómetro grande (Geist Mono 240 / 600). `ancho`: el lugar que tiene; si el valor no entra a
// `size` (un "10:00" de cinco caracteres en la columna de 580 de la estación) se achica la letra
// hasta que entre. Geist Mono avanza 0,6 em por carácter y el tracking resta 0,05 em.
const AVANCE_MONO = 0.6
const TRACKING = -12 / 240
// En Geist Mono los dos puntos ocupan un carácter entero y dejan un hueco grande ("19 : 55"): se
// les come 0,06 em de cada lado (Felipe, 2026-10-20).
const DOS_PUNTOS_EM = 0.06
// `muestra`: el valor más ancho que va a mostrar este reloj (p. ej. "20:00"), para que la letra no
// salte de tamaño cuando pasa de 10:00 a 9:59.
export function Cronometro({ valor, size = 240, ancho, muestra, color = COLOR.texto, estilo, ...resto }) {
  const n = Math.max(String(valor ?? '').length, String(muestra ?? '').length)
  const dosPuntos = /:/.test(String(muestra ?? valor ?? '')) ? 1 : 0
  if (ancho && n) size = Math.min(size, Math.floor(ancho / (n * AVANCE_MONO + (n - 1) * TRACKING - dosPuntos * 2 * DOS_PUNTOS_EM)))
  const k = size / 240
  return (
    <span
      {...resto}
      style={{
        fontFamily: MONO, fontSize: size, fontWeight: 600, lineHeight: 0.85, letterSpacing: -12 * k, color,
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...estilo,
      }}
    >
      {typeof valor === 'string' && valor.includes(':')
        ? valor.split(':').map((parte, idx) => (
            <span key={idx}>
              {idx > 0 && <span style={{ margin: `0 ${-DOS_PUNTOS_EM}em` }}>:</span>}
              {parte}
            </span>
          ))
        : valor}
    </span>
  )
}

// Barra de progreso de la estación (14 px, abajo del todo).
export function BarraProgreso({ fraccion, acento }) {
  const w = `${Math.round(Math.min(1, Math.max(0, fraccion || 0)) * 1000) / 10}%`
  return (
    <div data-testid="tv-progreso" style={{ height: 14, flexShrink: 0, borderRadius: RADIO.pildora, background: COLOR.pista, overflow: 'hidden' }}>
      <div style={{ width: w, height: '100%', borderRadius: RADIO.pildora, background: acento, transition: 'width 1s linear, background 0.5s ease' }} />
    </div>
  )
}

// Rondas / minutos: n barritas. `estado(i)` -> 'hecha' | 'actual' | 'falta'.
export function BarrasRondas({ n, estado, acento }) {
  return (
    <Grilla data-testid="tv-barras" cols={n} gap={10}>
      {Array.from({ length: n }, (_, i) => {
        const e = estado(i)
        return (
          <div
            key={i}
            style={{
              height: 16, borderRadius: RADIO.pildora, transition: 'background 0.5s ease, opacity 0.5s ease',
              background: e === 'falta' ? COLOR.borde : acento, opacity: e === 'actual' ? 0.55 : 1,
            }}
          />
        )
      })}
    </Grilla>
  )
}

// Miniatura 176x100 radio 16 (la del "SIGUE"): póster del ejercicio, su imagen o, si no hay, un
// primer cuadro del video.
export function Miniatura({ fila, ancho = 176, alto = 100 }) {
  const media = exerciseMedia(fila, 'tv')
  const base = { width: ancho, height: alto, borderRadius: RADIO.mini, objectFit: 'cover', display: 'block', flexShrink: 0, background: COLOR.superficie }
  if (media.kind === 'hosted' && media.poster) return <img src={media.poster} alt={fila.name} style={base} />
  if (media.kind === 'image') return <img src={media.src} alt={fila.name} style={base} />
  // Modo un video a la vez (TVs viejas, tv/turnoVideo.js): nunca un <video> más, ni de miniatura —
  // sin póster propio queda la superficie oscura, igual que cualquier ejercicio sin media.
  if (media.kind === 'hosted' && !UN_VIDEO) {
    return <video src={`${media.src}#t=0.4`} preload="metadata" muted playsInline style={{ ...base, ...media.style, width: ancho, height: alto }} />
  }
  return <div style={base} />
}

// Tarjeta de vidrio con miniatura: "SIGUE · Búlgara con KB". `fila` pone la miniatura, `texto` el nombre.
export function TarjetaSigue({ etiquetaTexto, fila, texto }) {
  return (
    <div data-testid="tv-tarjeta" style={{ ...superficie(RADIO.tarjeta), marginTop: 'auto', display: 'flex', gap: 20, alignItems: 'center', padding: 16, flexShrink: 0 }}>
      <Miniatura fila={fila} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={etiqueta(COLOR.texto45, 22, 5)}>{etiquetaTexto}</span>
        <span style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.15 }}>{texto ?? fila.name}</span>
      </div>
    </div>
  )
}

// Tarjeta "CÓMO SE JUEGA".
export function TarjetaComoSeJuega({ texto, estilo }) {
  return (
    <div data-testid="tv-tarjeta" style={{ ...superficie(RADIO.tarjeta), marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: 28, flexShrink: 0, ...estilo }}>
      <span style={etiqueta(COLOR.texto45, 22, 5)}>Cómo se juega</span>
      <span style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.2 }}>{texto}</span>
    </div>
  )
}

// Foto del socio en un círculo (avatar_url, URL pública del bucket 'avatars'); sin foto, o si no
// carga, sus iniciales. Para las TVs, que son anon y reciben ambas cosas dentro del payload.
export function Avatar({ url, iniciales, size = 64, fontSize, estilo }) {
  const [falla, setFalla] = useState(false)
  const base = {
    width: size, height: size, borderRadius: RADIO.pildora, flexShrink: 0, boxSizing: 'border-box', border: BORDE,
    overflow: 'hidden', background: COLOR.pista, display: 'flex', alignItems: 'center', justifyContent: 'center', ...estilo,
  }
  if (url && !falla) {
    return (
      <div style={base}>
        <img src={url} alt="" onError={() => setFalla(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )
  }
  return (
    <div style={{ ...base, fontSize: fontSize ?? Math.round(size * 0.4), fontWeight: 800, color: COLOR.texto, letterSpacing: 1 }}>
      {iniciales || '?'}
    </div>
  )
}
