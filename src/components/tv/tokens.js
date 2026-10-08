// Sistema de las TVs (rediseño 2026-10-05, ver spec "Sistema"). UN solo lugar para colores,
// radios, borde y tipografía: las pantallas no escriben valores sueltos.
//
//   · Fondo #050505 + manchas difuminadas del color del ESTADO.
//   · Acento (trabajo naranja / descanso azul) sólo en TEXTO, BARRAS y BORDES — nunca de fondo.
//   · Superficies: blanco 6% con borde de 2 px blanco 14%.
//   · Radios: 32 (video y paneles), 24 (tarjetas, número de estación), 16 (miniaturas, boxes),
//     píldora (chips). No hay otros.

export const GEIST = "'Geist', system-ui, -apple-system, sans-serif"
export const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

export const COLOR = {
  fondo: '#050505',
  trabajo: '#F45F37',
  descanso: '#5B8CFF',
  texto: '#F5F5F4',
  texto66: 'rgba(245,245,244,0.66)',
  texto45: 'rgba(245,245,244,0.45)',
  superficie: 'rgba(255,255,255,0.06)',
  borde: 'rgba(255,255,255,0.14)',
  pista: 'rgba(255,255,255,0.1)', // fondo de las barras de progreso y de los boxes ya hechos
  vidrio: 'rgba(5,5,5,0.55)', // chips sobre video
}

export const RADIO = { panel: 32, tarjeta: 24, mini: 16, pildora: 999 }

export const BORDE_PX = 2
export const BORDE_ACENTO_PX = 3 // contorno del siguiente box / anillo del contador
export const BORDE = `${BORDE_PX}px solid ${COLOR.borde}`

export const acentoDe = (descanso) => (descanso ? COLOR.descanso : COLOR.trabajo)

// Superficie de vidrio: tarjetas, paneles, chips.
export const superficie = (radio = RADIO.tarjeta, extra) => ({
  background: COLOR.superficie,
  border: BORDE,
  borderRadius: radio,
  boxSizing: 'border-box',
  ...extra,
})

// Etiquetas en versalitas (HOLA, ARRANCÁS EN, SIGUE...).
export const etiqueta = (color = COLOR.texto66, size = 24, spacing = 6) => ({
  fontSize: size,
  fontWeight: 700,
  letterSpacing: spacing,
  textTransform: 'uppercase',
  color,
})

// Degradé que oscurece el pie de un video para que el texto se lea.
export const velo = (desde = 55, hasta = 0.88) => `linear-gradient(180deg, rgba(5,5,5,0) ${desde}%, rgba(5,5,5,${hasta}) 100%)`

export const KEYFRAMES = `
@keyframes tvFadeIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes tvFadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes libreBlobA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(220px,120px) scale(1.25); } }
@keyframes libreBlobB { 0%,100% { transform: translate(0,0) scale(1.1); } 50% { transform: translate(-260px,-140px) scale(0.9); } }
@keyframes libreBlobC { 0%,100% { transform: translate(0,0) scale(0.9); } 50% { transform: translate(-160px,180px) scale(1.2); } }
@keyframes preparateNumIn { 0% { opacity: 0; transform: scale(0.55); filter: blur(22px); } 60% { opacity: 1; transform: scale(1.08); filter: blur(0); } 100% { opacity: 1; transform: scale(1); filter: blur(0); } }
@keyframes preparatePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
@keyframes tvTextoIn { 0% { opacity: 0; transform: translateY(22px) scale(0.97); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes caIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes caTitle { from { opacity: 0; transform: translateY(48px); filter: blur(12px); } to { opacity: 1; transform: none; filter: blur(0); } }
@keyframes caArrow { from { stroke-dashoffset: 40; opacity: 0; } to { stroke-dashoffset: 0; opacity: 1; } }
@keyframes caRoll { 0% { transform: translateY(0); } 75% { transform: translateY(-52%); } 100% { transform: translateY(-50%); } }
@keyframes caBoxOld { from { opacity: 1; color: rgba(245,245,244,0.9); } to { opacity: 1; color: rgba(245,245,244,0.45); } }
@keyframes caRing { from { transform: translateX(0); } to { transform: translateX(calc(100% + 14px)); } }
@keyframes caFoot { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .ca-anim { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; stroke-dashoffset: 0 !important; } }
@keyframes holaTick { 0% { transform: scale(1.35); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }
`
