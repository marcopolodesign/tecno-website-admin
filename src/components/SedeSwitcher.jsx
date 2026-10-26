import { useEffect, useRef, useState } from 'react'
import { MapPinIcon, CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { useSede } from '../contexts/SedeContext'

// La sede activa, siempre visible arriba del todo — mismo lenguaje visual que el space
// switcher (Gestión/Fitness) que ya vive en este sidebar. Con una sola sede es sólo una
// etiqueta (no hay nada para elegir); en cuanto haya una segunda se vuelve un desplegable
// sin que nadie tenga que tocar esto de nuevo.
export default function SedeSwitcher() {
  const { sede, sedes, loading, setSedeId } = useSede()
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (ev) => {
      if (ref.current && !ref.current.contains(ev.target)) setAbierto(false)
    }
    const escape = (ev) => ev.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  if (loading || !sede) return null

  const puedeElegir = sedes.length > 1

  return (
    <div className="pt-2" ref={ref}>
      <div className="relative">
        <button
          onClick={() => puedeElegir && setAbierto((v) => !v)}
          aria-haspopup={puedeElegir ? 'listbox' : undefined}
          aria-expanded={puedeElegir ? abierto : undefined}
          className={`w-full flex items-center gap-2.5 h-9 px-2.5 rounded-xl sidebar-surface transition-colors ${
            puedeElegir ? 'hover:bg-white/[0.17] cursor-pointer' : 'cursor-default'
          }`}
        >
          <MapPinIcon className="h-4 w-4 text-white/70 flex-shrink-0" />
          <span className="text-[13px] font-medium text-white/90 flex-1 text-left truncate">{sede.name}</span>
          {puedeElegir && <ChevronUpDownIcon className="h-4 w-4 text-white/60 flex-shrink-0" />}
        </button>

        {puedeElegir && abierto && (
          <div
            role="listbox"
            className="absolute left-0 right-0 mt-1.5 z-50 p-1.5 rounded-xl border border-white/20 bg-shell-deep shadow-xl max-h-64 overflow-y-auto"
          >
            {sedes.map((s) => {
              const activa = s.id === sede.id
              return (
                <button
                  key={s.id}
                  role="option"
                  aria-selected={activa}
                  onClick={() => {
                    setSedeId(s.id)
                    setAbierto(false)
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
                    activa ? 'bg-white/[0.13]' : 'hover:bg-white/[0.08]'
                  }`}
                >
                  <span className="flex-1 min-w-0 text-[13.5px] font-medium text-white truncate">{s.name}</span>
                  {activa && <CheckIcon className="h-4 w-4 text-white flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
