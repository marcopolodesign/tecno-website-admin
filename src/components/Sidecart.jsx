import { useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

/**
 * El panel lateral de la plataforma. Todo lo que se edita sale por acá.
 *
 * Entra de derecha a izquierda y queda flotando sobre el contenido: fondo blanco, esquinas
 * redondeadas, sombra apenas marcada. El velo de atrás es blanco y no negro — el contenido no
 * se esconde, se corre a un segundo plano, y la pantalla no cambia de peso cada vez que se abre
 * algo.
 *
 * En desktop ocupa el ancho que necesita, que es el punto: un pop-up centrado desperdicia la
 * pantalla y termina apretando una lista de ejercicios en una columna. En mobile toma todo,
 * porque ahí no hay espacio que repartir y media pantalla es peor que ninguna.
 *
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {string} title
 * @param {string} subtitle
 * @param {React.ReactNode} headerContent  debajo del título (chips, badges)
 * @param {React.ReactNode} children       contenido, scrollea
 * @param {React.ReactNode} footer         fijo abajo
 * @param {string} size  'sm' | 'md' | 'lg' | 'xl' | '2xl'
 * @param {number} zIndex
 */
export default function Sidecart({
  isOpen,
  onClose,
  title,
  subtitle,
  headerContent,
  children,
  footer,
  size = 'md',
  zIndex = 50,
}) {
  // Escape cierra. Es lo que la mano hace cuando el panel tapa lo que querías mirar, y sin esto
  // hay que ir a buscar la X o el borde.
  useEffect(() => {
    if (!isOpen) return
    const alTecla = (ev) => ev.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', alTecla)
    return () => window.removeEventListener('keydown', alTecla)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Más anchos que un modal a propósito: lo que entra acá son listas y formularios que en una
  // columna angosta se vuelven scroll infinito.
  const anchos = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-xl',
    lg: 'sm:max-w-3xl',
    xl: 'sm:max-w-5xl',
    '2xl': 'sm:max-w-6xl',
  }

  return (
    <>
      {/* Velo blanco: corre el contenido a un segundo plano en vez de apagarlo. */}
      <div
        className="fixed inset-0 bg-white/70 backdrop-blur-[2px] animate-fade-in"
        style={{ zIndex: zIndex - 1 }}
        onClick={onClose}
      />

      {/*
        Mobile: pantalla completa, sin bordes — no hay espacio que repartir.
        Desktop: separado del borde para que se lea como algo que flota, no como un cajón
        pegado a la pared.
      */}
      <div
        className={`fixed inset-0 sm:inset-y-4 sm:right-4 sm:left-auto w-full ${anchos[size] ?? anchos.md}
                    bg-white sm:rounded-2xl flex flex-col overflow-hidden animate-slide-in-right
                    shadow-[0_10px_40px_-12px_rgba(17,24,39,0.18)] ring-1 ring-black/5`}
        style={{ zIndex }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="px-5 py-4 border-b border-border-default shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
              {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-surface rounded-lg transition-colors -mt-1 -mr-1"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {headerContent && <div className="mt-4">{headerContent}</div>}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="px-5 py-4 border-t border-border-default bg-white shrink-0">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
