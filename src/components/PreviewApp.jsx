import { PlayIcon } from '@heroicons/react/24/solid'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

// Cómo va a ver el socio esta estación en el teléfono, mientras el coach la arma.
//
// El coach edita una grilla: filas, formato, segundos. El socio ve otra cosa — una lista
// numerada con el video de cada ejercicio y el reloj arriba. Entre las dos hay un salto que
// hoy sólo se cierra abriendo la app, y para eso hay que tener la rutina publicada y un
// teléfono a mano.
//
// Esto NO es la app embebida: es una réplica de su pantalla de estación
// (`tecnofit-app/app/rutina/estacion.tsx`), armada con los mismos datos que se están
// editando. Si aquella cambia, ésta queda desactualizada — es el precio de poder verlo
// sin publicar nada. Se copia lo que define la lectura: el encabezado naranja con la
// estación y las rondas, el círculo numerado con la línea vertical, el nombre con su
// pastilla de tiempo y el rectángulo del video.

const NARANJA = '#E07C2C'

// Mismo default que la app cuando el ejercicio no trae tiempos propios (`getEjercicioTabataSeconds`).
const TRABAJO_DEFAULT = 25
const DESCANSO_DEFAULT = 15

// Primero los campos del formato por tiempo, después los del modelo viejo de series x reps.
// No es un detalle de estilo: en una estación por tiempo `rest_time` queda con lo que haya
// dejado el modelo anterior — un Tabata de 20/10 tiene `rest_time = '60s'`, que además es
// texto y no un número. Leerlo primero mostraba 60 segundos de descanso donde hay 10.
function aSegundos(v) {
  if (typeof v === 'number') return v
  const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

function segundosDe(fila) {
  return {
    trabajo: fila?.trabajoSeg ?? aSegundos(fila?.repetitionTime) ?? TRABAJO_DEFAULT,
    descanso: fila?.descansoSeg ?? aSegundos(fila?.restTime) ?? DESCANSO_DEFAULT,
  }
}

export default function PreviewApp({ estacion, filas = [], formato }) {
  const primera = filas[0]
  const { trabajo, descanso } = segundosDe(primera)
  const rondas = formato?.rondas ?? primera?.rondas ?? 1

  return (
    <div className="mx-auto" style={{ maxWidth: 360 }}>
      {/* El marco del teléfono es lo que hace entender de un vistazo que esto es la app y no
          otra pantalla del admin. */}
      <div className="rounded-[2rem] bg-black p-2 shadow-xl">
        <div className="rounded-[1.6rem] bg-white overflow-hidden">
          {/* Header de la app */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
            <ArrowLeftIcon className="h-5 w-5 text-black/70" />
            <span className="text-sm font-medium text-black">Inicio</span>
            <span className="w-5" />
          </div>

          {/* Resumen de la estación */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
            <span className="text-xs font-semibold tracking-wide" style={{ color: NARANJA }}>
              ESTACIÓN {estacion ?? 1}
            </span>
            <div className="flex items-center gap-3 text-[11px] text-black/50">
              <span>x{rondas} ROUNDS</span>
              {filas.length > 0 && <span>{trabajo}s ON · {descanso}s OFF</span>}
            </div>
          </div>

          <div className="px-4 py-4 space-y-5 max-h-[420px] overflow-y-auto">
            {filas.length === 0 && (
              <p className="text-sm text-black/40 text-center py-10">
                Todavía no hay ejercicios en esta estación.
              </p>
            )}

            {filas.map((fila, i) => {
              const t = segundosDe(fila)
              const nombre = fila.exercises?.name ?? 'Ejercicio'
              const portada = fila.exercises?.thumbnailUrl ?? fila.exercises?.thumbnail_url ?? null
              const tieneVideo = Boolean(fila.exercises?.videoUrl ?? fila.exercises?.video_url)
              return (
                <div key={fila.id ?? i} className="flex gap-3">
                  {/* Círculo numerado + línea, igual que la app */}
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full border border-black flex items-center justify-center text-[11px] font-medium text-black">
                      {i + 1}
                    </div>
                    {i < filas.length - 1 && <div className="w-px flex-1 bg-black/80 mt-1" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-black leading-tight">{nombre}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/5 text-black/60 whitespace-nowrap">
                        {t.trabajo}ON - {t.descanso}OFF
                      </span>
                    </div>

                    <div className="mt-2 rounded-xl h-28 bg-black/5 flex items-center justify-center overflow-hidden relative">
                      {portada && (
                        <img src={portada} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      )}
                      {tieneVideo ? (
                        <span className="relative w-11 h-11 rounded-full bg-black/45 flex items-center justify-center">
                          <PlayIcon className="h-5 w-5 text-white" />
                        </span>
                      ) : (
                        // Decirlo acá vale más que en el grid: es donde se nota que al socio
                        // le va a faltar el video.
                        <span className="relative text-[11px] text-black/40">Sin video cargado</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className="text-xs text-text-tertiary text-center mt-3">
        Réplica de la pantalla del socio. Los videos y el reloj corren de verdad en el teléfono.
      </p>
    </div>
  )
}
