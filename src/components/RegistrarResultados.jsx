import { useCallback, useEffect, useState } from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid'
import workoutsService from '../services/workoutsService'

// Lo que el socio REALMENTE levantó en una sesión — no lo que el coach le había prescripto.
//
// Vive acá, colgado de la sesión concreta en Rutinas, porque es el mismo lugar donde el coach
// ya arma el plan (PesoSugerido, ahí al lado, contesta "¿qué le puse la vez pasada?" mientras
// arma la próxima semana). Esta pantalla contesta la pregunta complementaria — "¿qué pasó en
// esta sesión que ya se dio?" — con el mismo grano que session_exercises.weight_kg: un peso y
// unas reps por ejercicio, no por serie. No hay en el admin un tracker en vivo set a set, y
// agregar esa granularidad acá sin que nada la muestre después no suma nada.
//
// La fila de workout_sessions se crea (o reusa, ver workoutsService.ensureLoggingSession) al
// abrir, directamente en 'completed' — instructivo la primera vez que se lee, porque no calza
// con "iniciar/completar" de otros flujos: acá el coach está registrando algo que ya pasó, no
// viendo pasar un entrenamiento en vivo.
export default function RegistrarResultados({ session, clientId, onGuardado }) {
  const [workoutSessionId, setWorkoutSessionId] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [valores, setValores] = useState({}) // sessionExerciseId -> { pesoReal, repsReales, guardado }

  const filas = (session?.sessionExercises || [])
    .slice()
    .sort((a, b) => (a.boxNumber ?? 99) - (b.boxNumber ?? 99) || (a.exerciseOrder ?? 0) - (b.exerciseOrder ?? 0))

  const cargar = useCallback(async () => {
    if (!session?.id || !clientId) return
    setCargando(true)
    setError(null)
    try {
      const { data: ws } = await workoutsService.ensureLoggingSession(clientId, session.id)
      setWorkoutSessionId(ws.id)

      const { data: logs } = await workoutsService.getExerciseLogs(ws.id)
      const iniciales = {}
      for (const log of logs || []) {
        iniciales[log.sessionExerciseId] = {
          pesoReal: log.weightUsedKg != null ? String(log.weightUsedKg) : '',
          repsReales: log.actualReps != null ? String(log.actualReps) : '',
          guardado: true,
        }
      }
      setValores(iniciales)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setCargando(false)
    }
  }, [session?.id, clientId])

  useEffect(() => {
    cargar()
  }, [cargar])

  const cambiarValor = (sessionExerciseId, campo, valor) => {
    setValores((prev) => ({
      ...prev,
      [sessionExerciseId]: { ...prev[sessionExerciseId], [campo]: valor, guardado: false },
    }))
  }

  const guardarFila = async (fila) => {
    if (!workoutSessionId) return
    const v = valores[fila.id] || {}
    if (!v.pesoReal && !v.repsReales) return

    setGuardando(fila.id)
    setError(null)
    try {
      await workoutsService.upsertExerciseLog(workoutSessionId, fila.id, {
        weightUsedKg: v.pesoReal ? Number(v.pesoReal) : null,
        actualReps: v.repsReales ? Number(v.repsReales) : null,
      })

      setValores((prev) => ({ ...prev, [fila.id]: { ...prev[fila.id], guardado: true } }))
      onGuardado?.()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setGuardando(null)
    }
  }

  if (cargando) {
    return <p className="text-sm text-text-tertiary py-6 text-center">Cargando…</p>
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="text-xs text-text-tertiary">
        Un peso y unas reps por ejercicio — lo que efectivamente pasó en esa estación. Dejar en
        blanco lo que no se sepa: no hace falta completar todo para guardar el resto.
      </p>

      {filas.length === 0 && (
        <p className="text-sm text-text-tertiary py-6 text-center">Esta sesión no tiene ejercicios.</p>
      )}

      {filas.map((fila) => {
        const v = valores[fila.id] || {}
        return (
          <div key={fila.id} className="border border-border-default rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-brand uppercase tracking-wide">
                  {fila.isCooldown ? 'Cooldown' : fila.boxNumber ? `Estación ${fila.boxNumber}` : 'Sin estación'}
                </p>
                <p className="text-sm font-medium text-text-primary truncate">{fila.exercises?.name}</p>
                <p className="text-xs text-text-tertiary">
                  Prescripto: {fila.setsReps}
                  {fila.weightKg ? ` · ${Number(fila.weightKg)}kg` : ''}
                </p>
              </div>
              {v.guardado && (v.pesoReal || v.repsReales) && (
                <CheckCircleSolidIcon className="h-5 w-5 text-green-500 flex-shrink-0" title="Guardado" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="form-label">Peso real (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={v.pesoReal ?? ''}
                  onChange={(e) => cambiarValor(fila.id, 'pesoReal', e.target.value)}
                  onBlur={() => guardarFila(fila)}
                  className="form-input"
                  placeholder="Sin cargar"
                />
              </div>
              <div>
                <label className="form-label">Reps reales</label>
                <input
                  type="number"
                  value={v.repsReales ?? ''}
                  onChange={(e) => cambiarValor(fila.id, 'repsReales', e.target.value)}
                  onBlur={() => guardarFila(fila)}
                  className="form-input"
                  placeholder="Sin cargar"
                />
              </div>
            </div>

            {guardando === fila.id && <p className="text-xs text-text-tertiary mt-1">Guardando…</p>}
          </div>
        )
      })}

      <p className="text-xs text-text-tertiary flex items-center gap-1.5 pt-2">
        <CheckCircleIcon className="h-3.5 w-3.5" />
        Se guarda solo al salir del campo — no hace falta un botón aparte.
      </p>
    </div>
  )
}
