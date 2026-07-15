import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowPathIcon, ClockIcon, UserIcon } from '@heroicons/react/24/outline'
import { queueService, boxLabel } from '../services/queueService'

// Drift-free countdown driven off requestAnimationFrame + an absolute target
// timestamp, only setState-ing on integer-second change — same pattern as
// QueueTv.jsx (ported from Lucas Barral's box-display timer).
function useCountdown(targetIso) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    targetIso ? Math.max(0, Math.ceil((new Date(targetIso).getTime() - Date.now()) / 1000)) : null
  )

  useEffect(() => {
    if (!targetIso) {
      setSecondsLeft(null)
      return
    }
    const targetMs = new Date(targetIso).getTime()
    let rafId
    const loop = () => {
      const remaining = Math.max(0, Math.ceil((targetMs - Date.now()) / 1000))
      setSecondsLeft((prev) => (prev !== remaining ? remaining : prev))
      rafId = window.requestAnimationFrame(loop)
    }
    rafId = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(rafId)
  }, [targetIso])

  if (secondsLeft == null) return ''
  return `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
}

function formatWait(createdAt) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
  return `${mins} min`
}

function BoxCard({ box, lineNumber, onFree }) {
  const countdown = useCountdown(box.status === 'occupied' ? box.advances_at : null)
  const isOccupied = box.status === 'occupied'

  return (
    <div
      className={`rounded-lg border p-3 flex flex-col items-center gap-1 min-w-[120px] ${
        isOccupied ? 'border-brand bg-brand/5' : 'border-border-default bg-bg-surface'
      }`}
    >
      <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
        Box {boxLabel(lineNumber, box.boxes?.line_position)}
      </span>
      {isOccupied ? (
        <>
          <div className="flex items-center gap-1 text-text-primary font-medium text-sm">
            <UserIcon className="h-4 w-4" />
            {box.users ? `${box.users.first_name} ${box.users.last_name}` : 'Ocupado'}
          </div>
          <div className="flex items-center gap-1 text-xs text-brand font-mono">
            <ClockIcon className="h-3.5 w-3.5" />
            {countdown}
          </div>
          <button
            onClick={() => onFree(box.id)}
            className="text-xs text-text-tertiary hover:text-red-500 mt-1"
          >
            Liberar
          </button>
        </>
      ) : (
        <span className="text-xs text-text-tertiary py-2">Libre</span>
      )}
    </div>
  )
}

function LinePipeline({ line, onFreeBox, onSkipEntry }) {
  const [boxes, setBoxes] = useState([])
  const [queue, setQueue] = useState([])
  const unsubRef = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const [{ data: boxData }, { data: queueData }] = await Promise.all([
        queueService.getLineBoxStatus(line.id),
        queueService.getQueueForLine(line.id),
      ])
      setBoxes(boxData || [])
      setQueue(queueData || [])
    } catch (err) {
      console.error('Error refreshing line', line.id, err)
    }
  }, [line.id])

  useEffect(() => {
    refresh()
    unsubRef.current = queueService.subscribeToLine(line.id, refresh)
    return () => unsubRef.current?.()
  }, [line.id, refresh])

  const confirming = queue.find((q) => q.status === 'confirming')
  const waiting = queue.filter((q) => q.status === 'waiting')

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">{line.name}</h2>
        <span className="text-xs text-text-tertiary">{queue.length} en cola</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {boxes.map((box) => (
          <BoxCard key={box.id} box={box} lineNumber={line.line_number} onFree={onFreeBox} />
        ))}
        {boxes.length === 0 && (
          <p className="text-sm text-text-tertiary py-4">
            Esta línea no tiene boxes configurados todavía.
          </p>
        )}
      </div>

      {confirming && (
        <div className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 flex items-center justify-between text-sm">
          <span>
            <strong className="text-text-primary">
              {confirming.users ? `${confirming.users.first_name} ${confirming.users.last_name}` : 'Socio'}
            </strong>{' '}
            debe confirmar su turno para entrar al box 1
          </span>
          <button
            onClick={() => onSkipEntry(confirming.id)}
            className="text-xs text-text-tertiary hover:text-red-500"
          >
            Saltar
          </button>
        </div>
      )}

      {waiting.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">
            En espera
          </p>
          <div className="space-y-1">
            {waiting.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center justify-between text-sm px-3 py-2 rounded-md bg-bg-surface"
              >
                <span className="text-text-primary">
                  {i + 1}. {entry.users ? `${entry.users.first_name} ${entry.users.last_name}` : 'Socio'}
                </span>
                <span className="text-text-tertiary text-xs">{formatWait(entry.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function QueueMonitor() {
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLines = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await queueService.getLines()
      setLines(data || [])
    } catch (err) {
      console.error('Error fetching production lines:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLines()
  }, [fetchLines])

  const handleFreeBox = async (lineBoxStatusId) => {
    try {
      await queueService.freeBox(lineBoxStatusId)
    } catch (err) {
      console.error('Error freeing box:', err)
    }
  }

  const handleSkipEntry = async (queueEntryId) => {
    try {
      await queueService.skipQueueEntry(queueEntryId)
    } catch (err) {
      console.error('Error skipping entry:', err)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Lista de Espera</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Monitor en vivo de líneas y boxes
          </p>
        </div>
        <button onClick={fetchLines} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : lines.length === 0 ? (
        <div className="card text-center py-16 text-text-secondary text-sm">
          No hay líneas configuradas. Creá una desde{' '}
          <a href="/lista-espera/config" className="text-brand underline">
            Configuración
          </a>
          .
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {lines.map((line) => (
            <LinePipeline
              key={line.id}
              line={line}
              onFreeBox={handleFreeBox}
              onSkipEntry={handleSkipEntry}
            />
          ))}
        </div>
      )}
    </div>
  )
}
