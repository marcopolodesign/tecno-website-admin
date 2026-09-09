import { useEffect, useRef, useState } from 'react'

// El benchmark es contexto, no un dato de la tarjeta: sirve cuando alguien se pregunta
// "¿y esto está bien o mal?", no cada vez que mira el panel. Por eso no ocupa lugar fijo
// y aparece recién si el mouse se queda quieto sobre el título — una demora larga a
// propósito (2,5s), para que no salte al pasar el mouse de camino a otra cosa.
const DEMORA_MS = 2500

export default function BenchmarkTooltip({ label, children }) {
  const [visible, setVisible] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!label) return children

  const arrancar = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(true), DEMORA_MS)
  }
  const cortar = () => {
    clearTimeout(timer.current)
    setVisible(false)
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={arrancar}
      onMouseLeave={cortar}
      // El teclado no espera: quien llega tabulando ya pidió el foco explícitamente.
      onFocus={() => setVisible(true)}
      onBlur={cortar}
      tabIndex={0}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className="absolute left-0 top-full mt-1.5 z-20 whitespace-nowrap rounded-lg
                     bg-text-primary px-2.5 py-1.5 text-xs font-normal text-white
                     shadow-lg animate-fade-in"
        >
          {label}
        </span>
      )}
    </span>
  )
}
