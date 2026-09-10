import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ArrowPathIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { queueService, boxLabel } from '../services/queueService'
import { usersService } from '../services/usersService'
import hoyService from '../services/hoyService'
import cajaService from '../services/cajaService'
import { useSede } from '../contexts/SedeContext'
import { formatARS } from '../lib/dinero'
import Sidecart from './Sidecart'

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

const nombreDe = (u) => (u ? `${u.first_name} ${u.last_name}`.trim() : 'Socio')

function iniciales(u) {
  if (!u) return '?'
  return `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase() || '?'
}

// Foto del socio. Hoy `users.avatar_url` está vacío para todos, así que en la práctica se
// ven las iniciales — pero el día que se carguen las fotos esto ya las muestra, y las
// iniciales quedan como respaldo permanente para el que no tenga.
function Avatar({ user, size = 'md', riesgo }) {
  const px = size === 'lg' ? 'h-12 w-12 text-base' : size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-xs'
  const anillo = riesgo === 'high_risk' ? 'ring-2 ring-error' : riesgo === 'risk' ? 'ring-2 ring-warning' : ''

  return (
    <span className={`${px} ${anillo} rounded-full overflow-hidden shrink-0 inline-flex items-center justify-center bg-brand/10 text-brand font-semibold`}>
      {user?.avatar_url ? (
        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        iniciales(user)
      )}
    </span>
  )
}

const RIESGO_TEXTO = { high_risk: 'Alto riesgo', risk: 'Riesgo' }

// El riesgo va con el nombre, no escondido en una pantalla de métricas: quien atiende la
// sala es quien puede hacer algo al respecto mientras la persona está adentro.
function RiesgoBadge({ riesgo, dias, compact = false }) {
  if (!riesgo) return null
  const tono = riesgo === 'high_risk' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tono}`}>
      <ExclamationTriangleIcon className="h-3 w-3" />
      {compact ? RIESGO_TEXTO[riesgo] : `${RIESGO_TEXTO[riesgo]}${dias != null ? ` · ${dias}d sin venir` : ''}`}
    </span>
  )
}

function BoxCard({ box, lineNumber, onFree, riesgo, onVerSocio }) {
  const countdown = useCountdown(box.status === 'occupied' ? box.advances_at : null)
  const isOccupied = box.status === 'occupied'

  return (
    <div
      className={`rounded-lg border p-3 flex flex-col items-center gap-1.5 flex-1 min-w-[150px] ${
        isOccupied ? 'border-brand bg-brand/5' : 'border-border-default bg-bg-surface'
      }`}
    >
      <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
        Box {boxLabel(lineNumber, box.boxes?.line_position)}
      </span>
      {isOccupied ? (
        <>
          {/* Toda la ficha del socio es el botón, no un ícono chiquito al costado: en una
              tablet de mostrador lo que se toca es la persona. */}
          <button
            type="button"
            onClick={() => box.users && onVerSocio(box.users.id)}
            disabled={!box.users}
            className="flex flex-col items-center gap-1 w-full rounded-md p-1 transition-colors enabled:hover:bg-brand/10"
          >
            <Avatar user={box.users} riesgo={riesgo?.risk_bucket} />
            <span className="text-text-primary font-medium text-sm text-center leading-tight">
              {box.users ? nombreDe(box.users) : 'Ocupado'}
            </span>
            {riesgo && <RiesgoBadge riesgo={riesgo.risk_bucket} dias={riesgo.days_since_last_visit} compact />}
          </button>
          <div className="flex items-center gap-1 text-xs text-brand font-mono">
            <ClockIcon className="h-3.5 w-3.5" />
            {countdown}
          </div>
          <button
            onClick={() => onFree(box.id)}
            className="text-xs text-text-tertiary hover:text-red-500"
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

function LinePipeline({ line, onFreeBox, onSkipEntry, riesgoPorUsuario, onVerSocio }) {
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

  // `getQueueForLine` sigue trayendo waiting + confirming, pero con la cola única por sede
  // los que esperan ya no tienen línea: en la práctica acá sólo cae el que está
  // confirmando su turno para entrar a ESTA línea. La lista de espera se dibuja una sola
  // vez, abajo de todas las líneas.

  useEffect(() => {
    refresh()
    unsubRef.current = queueService.subscribeToLine(line.id, refresh)
    return () => unsubRef.current?.()
  }, [line.id, refresh])

  const confirming = queue.find((q) => q.status === 'confirming')
  const ocupados = boxes.filter((b) => b.status === 'occupied').length

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">{line.name}</h2>
        <span className="text-xs text-text-tertiary">
          {ocupados} de {boxes.length} en uso
        </span>
      </div>

      {/* Wrap, no scroll horizontal (Mateo, 2026-09-10): media línea escondida a la derecha
          es media línea que nadie mira. Con las líneas apiladas hay ancho de sobra. */}
      <div className="flex flex-wrap gap-3">
        {boxes.map((box) => (
          <BoxCard
            key={box.id}
            box={box}
            lineNumber={line.line_number}
            onFree={onFreeBox}
            riesgo={box.users ? riesgoPorUsuario.get(box.users.id) : null}
            onVerSocio={onVerSocio}
          />
        ))}
        {boxes.length === 0 && (
          <p className="text-sm text-text-tertiary py-4">
            Esta línea no tiene boxes configurados todavía.
          </p>
        )}
      </div>

      {confirming && (
        <div className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={() => confirming.users && onVerSocio(confirming.users.id)}
            className="flex items-center gap-2 min-w-0 text-left"
          >
            <Avatar
              user={confirming.users}
              size="sm"
              riesgo={confirming.users ? riesgoPorUsuario.get(confirming.users.id)?.risk_bucket : null}
            />
            <span className="min-w-0">
              <strong className="text-text-primary">{nombreDe(confirming.users)}</strong>{' '}
              debe confirmar su turno para entrar al box 1
            </span>
          </button>
          <button
            onClick={() => onSkipEntry(confirming.id)}
            className="text-xs text-text-tertiary hover:text-red-500 shrink-0"
          >
            Saltar
          </button>
        </div>
      )}

    </div>
  )
}

// La lista de espera de la sede: una sola para todas las líneas (2026-09-10). Nadie elige
// línea — se entra a la que se libere primero, así que el orden de llegada es lo único que
// importa y mostrarlo partido en dos columnas mentía sobre quién va antes.
function ListaDeEspera({ entries, riesgoPorUsuario, onVerSocio }) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Lista de espera</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            Una sola para toda la sede — entra a la línea que se libere primero
          </p>
        </div>
        <span className="text-xs text-text-tertiary">
          {entries.length} {entries.length === 1 ? 'persona' : 'personas'}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-6">No hay nadie esperando.</p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry, i) => {
            const riesgo = entry.users ? riesgoPorUsuario.get(entry.users.id) : null
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => entry.users && onVerSocio(entry.users.id)}
                className="w-full flex items-center justify-between gap-3 text-sm px-3 py-2 rounded-md bg-bg-surface text-left transition-colors hover:brightness-[0.97]"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="text-text-tertiary text-xs w-4 shrink-0">{i + 1}</span>
                  <Avatar user={entry.users} size="sm" riesgo={riesgo?.risk_bucket} />
                  <span className="text-text-primary truncate">{nombreDe(entry.users)}</span>
                  {riesgo && <RiesgoBadge riesgo={riesgo.risk_bucket} dias={riesgo.days_since_last_visit} compact />}
                </span>
                <span className="text-text-tertiary text-xs shrink-0">{formatWait(entry.created_at)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Ficha corta del socio, para el que atiende la sala. No es la de la pantalla de Socios —
// ahí se edita, acá se decide en diez segundos si hay algo que hacer con esta persona
// mientras la tenés adelante.
function SocioSidecart({ userId, onClose, riesgo }) {
  const [socio, setSocio] = useState(null)
  const [saldo, setSaldo] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) return
    setCargando(true)
    setError(null)
    setSocio(null)
    setSaldo(null)
    usersService
      .getUserDetalle(userId)
      .then(setSocio)
      .catch(setError)
      .finally(() => setCargando(false))
    // El saldo es un extra: si falla, la ficha se muestra igual sin esa línea.
    cajaService.saldoSocio(userId).then(setSaldo).catch(() => setSaldo(null))
  }, [userId])

  const vence = socio?.membership_end_date
    ? Math.ceil((new Date(socio.membership_end_date) - new Date()) / 86400000)
    : null

  return (
    <Sidecart isOpen={!!userId} onClose={onClose} title={socio ? nombreDe(socio) : 'Socio'} subtitle="Ficha rápida">
      {cargando ? (
        <div className="h-40 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-sm text-error">{error.message}</p>
      ) : socio ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar user={socio} size="lg" riesgo={riesgo?.risk_bucket} />
            <div className="min-w-0">
              <p className="text-base font-semibold text-text-primary truncate">{nombreDe(socio)}</p>
              <p className="text-xs text-text-tertiary truncate">{socio.email}</p>
            </div>
          </div>

          {riesgo && (
            <div className="rounded-lg bg-error/5 p-3">
              <RiesgoBadge riesgo={riesgo.risk_bucket} dias={riesgo.days_since_last_visit} />
              <p className="text-xs text-text-secondary mt-1.5">
                Está entrenando ahora. Es el momento de hablarle.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Dato label="Teléfono" valor={socio.phone} />
            <Dato label="DNI" valor={socio.dni} />
            <Dato label="Membresía" valor={socio.membership_type} />
            <Dato
              label="Estado"
              valor={socio.membership_status}
              tono={socio.membership_status === 'active' ? 'ok' : 'alerta'}
            />
            <Dato
              label="Vence"
              valor={
                socio.membership_end_date
                  ? `${new Date(socio.membership_end_date).toLocaleDateString('es-AR')}${vence != null ? ` · ${vence}d` : ''}`
                  : null
              }
              tono={vence != null && vence <= 7 ? 'alerta' : undefined}
            />
            {saldo != null && Number(saldo) !== 0 && (
              <Dato label="Debe en caja" valor={formatARS(saldo)} tono="alerta" />
            )}
          </div>

          {(socio.medical_notes || socio.contraindicaciones) && (
            <div className="rounded-lg bg-warning/5 p-3">
              <p className="text-xs font-semibold text-warning mb-1">Ojo con esto</p>
              <p className="text-sm text-text-secondary whitespace-pre-line">
                {[socio.contraindicaciones, socio.medical_notes].filter(Boolean).join('\n')}
              </p>
            </div>
          )}

          <a href={`/users?socio=${socio.id}`} className="btn-secondary w-full text-center block">
            Ver ficha completa
          </a>
        </div>
      ) : (
        <p className="text-sm text-text-tertiary">No se encontró el socio.</p>
      )}
    </Sidecart>
  )
}

function Dato({ label, valor, tono }) {
  if (!valor) return null
  const color = tono === 'alerta' ? 'text-error' : tono === 'ok' ? 'text-success' : 'text-text-primary'
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-tertiary">{label}</span>
      <span className={`font-medium text-right ${color}`}>{valor}</span>
    </div>
  )
}

export default function QueueMonitor() {
  const { sedeId } = useSede()
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [espera, setEspera] = useState([])
  const [riesgo, setRiesgo] = useState([])
  const [socioAbierto, setSocioAbierto] = useState(null)

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

  const fetchEspera = useCallback(async () => {
    try {
      const { data } = await queueService.getWaitingForLocation(sedeId)
      setEspera(data || [])
    } catch (err) {
      console.error('Error fetching waiting list:', err)
    }
  }, [sedeId])

  useEffect(() => {
    fetchLines()
  }, [fetchLines])

  // La lista de espera se mantiene sola por Realtime — recepción no aprieta nada. El botón
  // Actualizar queda como red de seguridad para el caso de una TV que perdió el socket.
  useEffect(() => {
    fetchEspera()
    const unsub = queueService.subscribeToLocationQueue(sedeId, fetchEspera)
    return () => unsub?.()
  }, [sedeId, fetchEspera])

  // El riesgo cambia por día, no por minuto: se pide una vez al entrar y no se re-suscribe.
  useEffect(() => {
    hoyService.getSociosEnRiesgo({ sedeId }).then(setRiesgo).catch(() => setRiesgo([]))
  }, [sedeId])

  const riesgoPorUsuario = useMemo(
    () => new Map(riesgo.map((r) => [r.user_id, r])),
    [riesgo]
  )

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
            Monitor en vivo — se actualiza solo
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
        <>
          {/* Apiladas, no en dos columnas (Mateo, 2026-09-10): con media pantalla cada una
              las estaciones no entraban y quedaban detrás de un scroll horizontal. A lo
              ancho entran las cinco de una. */}
          <div className="flex flex-col gap-4">
            {lines.map((line) => (
              <LinePipeline
                key={line.id}
                line={line}
                onFreeBox={handleFreeBox}
                onSkipEntry={handleSkipEntry}
                riesgoPorUsuario={riesgoPorUsuario}
                onVerSocio={setSocioAbierto}
              />
            ))}
          </div>

          <ListaDeEspera
            entries={espera}
            riesgoPorUsuario={riesgoPorUsuario}
            onVerSocio={setSocioAbierto}
          />
        </>
      )}

      <SocioSidecart
        userId={socioAbierto}
        onClose={() => setSocioAbierto(null)}
        riesgo={socioAbierto ? riesgoPorUsuario.get(socioAbierto) : null}
      />
    </div>
  )
}
