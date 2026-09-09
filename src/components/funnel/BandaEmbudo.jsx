// La banda del embudo: una sola cinta que se angosta de izquierda a derecha, con la
// conversión entre etapas en cada frontera. La forma es la que ya usamos en el mk1 de
// Ninjo — un solo path continuo (borde de arriba de ida, arco a la derecha, borde de
// abajo de vuelta), simétrico respecto del eje horizontal.
//
// Por qué una cinta y no barras: el ancho de la cinta ES la gente que queda. Con barras
// sueltas hay que comparar alturas a ojo; acá la caída se ve como un estrangulamiento.

const ANCHO_ETAPA = 100
const ALTO_VB = 132
const CY = ALTO_VB / 2
const MEDIO_MAX = 48
const MEDIO_MIN = 5

export default function BandaEmbudo({ etapas, etapaActiva, onSelect }) {
  const n = etapas.length
  if (!n) return null

  const tope = etapas[0]?.cuenta || 1
  const anchoVB = n * ANCHO_ETAPA
  const cx = (i) => i * ANCHO_ETAPA + ANCHO_ETAPA / 2
  // El piso de 5 evita que una etapa en cero desaparezca: cero también es información.
  const medio = (cuenta) => Math.max(MEDIO_MIN, (cuenta / tope) * MEDIO_MAX)
  const medios = etapas.map((e) => medio(Number(e.cuenta)))

  let d = `M 0,${CY - medios[0]} L ${cx(0)},${CY - medios[0]}`
  for (let i = 0; i < n - 1; i++) {
    const mx = (cx(i) + cx(i + 1)) / 2
    d += ` C ${mx},${CY - medios[i]} ${mx},${CY - medios[i + 1]} ${cx(i + 1)},${CY - medios[i + 1]}`
  }
  d += ` L ${anchoVB},${CY - medios[n - 1]}`
  const r = medios[n - 1]
  d += ` A ${r} ${r} 0 0 1 ${anchoVB},${CY + r}`
  d += ` L ${cx(n - 1)},${CY + medios[n - 1]}`
  for (let i = n - 2; i >= 0; i--) {
    const mx = (cx(i) + cx(i + 1)) / 2
    d += ` C ${mx},${CY + medios[i + 1]} ${mx},${CY + medios[i]} ${cx(i)},${CY + medios[i]}`
  }
  d += ` L 0,${CY + medios[0]} Z`

  return (
    <div className="min-w-[720px]">
      <div className="relative">
        <svg
          viewBox={`0 0 ${anchoVB} ${ALTO_VB}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: ALTO_VB }}
          role="img"
          aria-label="Embudo de captación"
        >
          <path d={d} fill="var(--color-brand)" opacity={etapaActiva ? 0.22 : 0.9} />

          {/* La etapa elegida se pinta entera; el resto queda de fondo. Recortar el mismo
              path con un rectángulo evita dibujar dos formas que después no coinciden. */}
          {etapaActiva ? (
            <>
              <defs>
                <clipPath id="franja-activa">
                  <rect
                    x={(etapaActiva - 1) * ANCHO_ETAPA}
                    y="0"
                    width={ANCHO_ETAPA}
                    height={ALTO_VB}
                  />
                </clipPath>
              </defs>
              <path d={d} fill="var(--color-brand)" clipPath="url(#franja-activa)" />
            </>
          ) : null}

          {/* Separadores: dónde termina una etapa y empieza la otra. */}
          {etapas.slice(0, -1).map((_, i) => (
            <line
              key={i}
              x1={(i + 1) * ANCHO_ETAPA}
              y1="0"
              x2={(i + 1) * ANCHO_ETAPA}
              y2={ALTO_VB}
              stroke="var(--color-bg-secondary)"
              strokeWidth="1.5"
            />
          ))}

          {/* Zonas de click, invisibles, del alto completo — no obligan a apuntarle a la cinta. */}
          {etapas.map((e, i) => (
            <rect
              key={e.orden}
              x={i * ANCHO_ETAPA}
              y="0"
              width={ANCHO_ETAPA}
              height={ALTO_VB}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onSelect(etapaActiva === e.orden ? null : e.orden)}
            />
          ))}
        </svg>

        {/* Conversión en cada frontera, encima de la cinta. */}
        {etapas.map((e, i) => {
          if (e.conversion_desde_anterior === null || i === 0) return null
          const anterior = Number(etapas[i - 1].cuenta)
          const perdidos = anterior - Number(e.cuenta)
          return (
            <div
              key={e.orden}
              className="pointer-events-none absolute z-10 flex items-center gap-1.5 rounded-full bg-bg-secondary px-2 py-0.5 text-[11px] shadow-sm"
              style={{ left: `${((i * ANCHO_ETAPA) / anchoVB) * 100}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
            >
              {e.es_mayor_caida && (
                <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-600">
                  ↓ mayor caída
                </span>
              )}
              <span className="font-semibold text-text-primary">{e.conversion_desde_anterior}%</span>
              {perdidos > 0 && <span className="text-text-tertiary">−{perdidos}</span>}
            </div>
          )
        })}
      </div>

      {/* Los números van abajo, no adentro de la cinta: adentro no entran cuando la etapa
          se angosta, y quedarían tapados justo en las etapas que más importan. */}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {etapas.map((e) => {
          const activa = etapaActiva === e.orden
          return (
            <button
              key={e.orden}
              type="button"
              onClick={() => onSelect(activa ? null : e.orden)}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 transition-colors ${
                activa ? 'bg-brand/10' : 'hover:bg-bg-surface'
              }`}
            >
              <span className={`text-xs ${activa ? 'font-semibold text-brand' : 'text-text-secondary'}`}>
                {e.etiqueta}
              </span>
              <span className="text-lg font-semibold text-text-primary">{e.cuenta}</span>
              <span className="text-[11px] text-text-tertiary">{e.conversion_desde_arriba}% del total</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
