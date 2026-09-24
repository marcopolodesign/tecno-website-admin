import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { ArrowPathIcon, ClockIcon } from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'
import { queueService, boxLabel } from '../services/queueService'
import { usersService } from '../services/usersService'
import hoyService from '../services/hoyService'
import cajaService from '../services/cajaService'
import { supabase } from '../lib/supabase'
import { useSede } from '../contexts/SedeContext'
import { formatARS } from '../lib/dinero'
import { toastOptions } from '../lib/themeStyles'
import { useCountdown as useCountdownSeg, useBoxPhase, explicacionSegDeLinea, formatMMSS } from '../lib/tvClock'
import { tvUrlSede, tvUrlLinea } from '../lib/slug'
import Sidecart from './Sidecart'
import RiesgoBadge from './RiesgoBadge'

// Estado de una entrada ya en la cola, para el aviso de "ya está anotado" — mismo vocabulario
// que usa EN_SALA_LABEL en Hoy.jsx.
const ESTADO_COLA_LABEL = { waiting: 'esperando turno', confirming: 'confirmando su turno', in_box: 'entrenando' }

// Drift-free countdown driven off requestAnimationFrame + an absolute target timestamp — mismo
// patrón que tvClock.js, acá sólo formateado mm:ss directo (varias filas de este monitor lo
// usan sin pasar por formatMMSS explícito).
function useCountdown(targetIso) {
  return formatMMSS(useCountdownSeg(targetIso))
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

function BoxCard({ box, line, onFree, riesgo, onVerSocio }) {
  const countdown = useCountdown(box.status === 'occupied' ? box.advances_at : null)
  const isOccupied = box.status === 'occupied'
  const phase = useBoxPhase(isOccupied ? box.entered_at : null, explicacionSegDeLinea(line))

  return (
    <div
      className={`rounded-lg border p-3 flex flex-col items-center gap-1.5 flex-1 min-w-[150px] ${
        isOccupied ? 'border-brand bg-brand/5' : 'border-border-default bg-bg-surface'
      }`}
    >
      <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
        Box {boxLabel(line?.line_number, box.boxes?.line_position)}
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
          {/* Explicación vs. estación: quien atiende la sala ve si todavía está en el minuto
              de explicación (mismo cálculo que usa la TV, no una aproximación aparte). */}
          <span className={`text-[11px] font-mono ${phase.fase === 'explicacion' ? 'text-amber-600' : 'text-text-tertiary'}`}>
            {phase.fase === 'explicacion' ? `Explicación ${formatMMSS(phase.restanteExplicacionSeg)}` : `Estación ${countdown}`}
          </span>
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
        <div className="flex items-center gap-3">
          <a
            href={`/lista-espera/tv/${line.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-text-tertiary hover:text-brand"
            title={line.locations?.name ? tvUrlLinea(line.locations.name, line.line_number) : undefined}
          >
            Ver TV
          </a>
          <span className="text-xs text-text-tertiary">
            {ocupados} de {boxes.length} en uso
          </span>
        </div>
      </div>

      {/* Wrap, no scroll horizontal (Mateo, 2026-09-10): media línea escondida a la derecha
          es media línea que nadie mira. Con las líneas apiladas hay ancho de sobra. */}
      <div className="flex flex-wrap gap-3">
        {boxes.map((box) => (
          <BoxCard
            key={box.id}
            box={box}
            line={line}
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

// Anotar a un socio en la lista de espera desde el admin (weekly 2026-09-24): backup para
// cuando no tiene el teléfono a mano o no tiene la app. Busca entre los socios de la sede
// actual y hace el mismo insert que la app (`joinQueue` en tecnofit-app/lib/queue.ts: sólo
// user_id + location_id, sin línea — se estampa recién al promover, ver
// 20260910180000_lista_espera_unica_por_sede.sql) más el mismo registro de acceso que deja el
// kiosco, con method 'manual_admin' para poder distinguirlo en Accesos.
function AnotarSocioSidecart({ isOpen, onClose, sedeId, onAnotado }) {
  const [q, setQ] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState([])
  const [seleccionado, setSeleccionado] = useState(null)
  const [entradaExistente, setEntradaExistente] = useState(null)
  const [verificando, setVerificando] = useState(false)
  const [anotando, setAnotando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) return
    // Se limpia recién al cerrar, no al abrir — así si lo cierran por error y lo reabren en
    // seguida no perdieron la búsqueda.
    const t = setTimeout(() => {
      setQ('')
      setResultados([])
      setSeleccionado(null)
      setEntradaExistente(null)
      setError(null)
    }, 200)
    return () => clearTimeout(t)
  }, [isOpen])

  useEffect(() => {
    const termino = q.trim()
    if (termino.length < 2 || !sedeId) {
      setResultados([])
      return
    }
    setBuscando(true)
    const t = setTimeout(async () => {
      const { data, error: err } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, dni, membership_status, membership_end_date')
        .eq('location_id', sedeId)
        .or(`first_name.ilike.%${termino}%,last_name.ilike.%${termino}%,dni.ilike.%${termino}%,email.ilike.%${termino}%`)
        .limit(8)
      if (!err) setResultados(data || [])
      setBuscando(false)
    }, 250)
    return () => clearTimeout(t)
  }, [q, sedeId])

  // Bloquear duplicados: si el socio ya tiene una entrada activa se muestra en vez de dejar
  // anotarlo de nuevo — insertar otra fila lo pondría dos veces en la misma cola.
  const elegir = async (socio) => {
    setSeleccionado(socio)
    setEntradaExistente(null)
    setError(null)
    setVerificando(true)
    try {
      const { data, error: err } = await supabase
        .from('queue_entries')
        .select('id, status, created_at')
        .eq('user_id', socio.id)
        .in('status', ['waiting', 'confirming', 'in_box'])
        .maybeSingle()
      if (err) throw err
      setEntradaExistente(data || null)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setVerificando(false)
    }
  }

  const anotar = async () => {
    if (!seleccionado || !sedeId) return
    setAnotando(true)
    setError(null)
    try {
      const { error: errCola } = await supabase
        .from('queue_entries')
        .insert({ user_id: seleccionado.id, location_id: sedeId })
      if (errCola) throw errCola

      // El mismo registro que deja el kiosco al dar un ingreso (ver MemberAccess.jsx →
      // logAccess). No bloquea el anotado si falla: es historial, no el hecho en sí.
      const { error: errAcceso } = await supabase.from('access_logs').insert({
        user_id: seleccionado.id,
        location_id: sedeId,
        method: 'manual_admin',
        granted: true,
      })
      if (errAcceso) console.error('access_logs insert error:', errAcceso)

      toast.success(`${nombreDe(seleccionado)} — anotado en la lista de espera`, toastOptions)
      onAnotado?.()
      onClose()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setAnotando(false)
    }
  }

  const vencida = seleccionado && seleccionado.membership_status !== 'active'

  return (
    <Sidecart
      isOpen={isOpen}
      onClose={onClose}
      title="Anotar socio"
      subtitle="Backup para cuando no tiene el teléfono o la app a mano"
      size="sm"
    >
      <div className="space-y-4">
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setSeleccionado(null)
            setEntradaExistente(null)
          }}
          placeholder="Nombre, DNI o email"
          className="form-input"
        />

        {buscando && <p className="text-sm text-text-tertiary">Buscando…</p>}

        {!seleccionado && !buscando && resultados.length > 0 && (
          <div className="space-y-1">
            {resultados.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => elegir(u)}
                className="w-full flex items-center justify-between gap-3 text-sm px-3 py-2 rounded-md bg-bg-surface text-left transition-colors hover:brightness-[0.97]"
              >
                <span className="min-w-0 truncate text-text-primary">{nombreDe(u)}</span>
                <span className="text-xs text-text-tertiary shrink-0">{u.dni || u.email}</span>
              </button>
            ))}
          </div>
        )}

        {!buscando && q.trim().length >= 2 && resultados.length === 0 && !seleccionado && (
          <p className="text-sm text-text-tertiary text-center py-4">
            Ningún socio de esta sede coincide con esa búsqueda.
          </p>
        )}

        {seleccionado && (
          <div className="card border-0 shadow-none space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-text-primary">{nombreDe(seleccionado)}</p>
              <button
                type="button"
                onClick={() => {
                  setSeleccionado(null)
                  setEntradaExistente(null)
                }}
                className="text-xs text-text-tertiary hover:text-brand shrink-0"
              >
                Cambiar
              </button>
            </div>

            {vencida && (
              <p className="text-xs text-warning bg-warning/10 rounded-md px-2.5 py-1.5">
                Membresía {seleccionado.membership_status === 'cancelled' ? 'cancelada' : 'vencida'} — se
                puede anotar igual, pero avisale en el mostrador.
              </p>
            )}

            {verificando ? (
              <p className="text-sm text-text-tertiary">Verificando si ya está en la cola…</p>
            ) : entradaExistente ? (
              <p className="text-sm text-text-secondary bg-bg-surface rounded-md px-2.5 py-2">
                Ya está en la lista de espera —{' '}
                {ESTADO_COLA_LABEL[entradaExistente.status] || entradaExistente.status}, desde hace{' '}
                {formatWait(entradaExistente.created_at)}.
              </p>
            ) : (
              <button type="button" onClick={anotar} disabled={anotando} className="btn-primary w-full">
                {anotando ? 'Anotando…' : 'Anotar en la lista de espera'}
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-error">{error}</p>}
      </div>
    </Sidecart>
  )
}

// La lista de espera de la sede: una sola para todas las líneas (2026-09-10). Nadie elige
// línea — se entra a la que se libere primero, así que el orden de llegada es lo único que
// importa y mostrarlo partido en dos columnas mentía sobre quién va antes.
function ListaDeEspera({ entries, riesgoPorUsuario, onVerSocio, onAnotarSocio }) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Lista de espera</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            Una sola para toda la sede — entra a la línea que se libere primero
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary">
            {entries.length} {entries.length === 1 ? 'persona' : 'personas'}
          </span>
          <button type="button" onClick={onAnotarSocio} className="btn-secondary text-xs py-1.5 px-2.5">
            Anotar socio
          </button>
        </div>
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
function SocioSidecart({ userId, onClose, riesgo: riesgoDeSala }) {
  const [socio, setSocio] = useState(null)
  const [saldo, setSaldo] = useState(null)
  const [riesgoPropio, setRiesgoPropio] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!userId) return
    setCargando(true)
    setError(null)
    setSocio(null)
    setSaldo(null)
    setRiesgoPropio(null)
    usersService
      .getUserDetalle(userId)
      .then(setSocio)
      .catch(setError)
      .finally(() => setCargando(false))
    // El saldo es un extra: si falla, la ficha se muestra igual sin esa línea.
    cajaService.saldoSocio(userId).then(setSaldo).catch(() => setSaldo(null))
    // El riesgo va SIEMPRE en la ficha, esté o no la persona en la sala ahora mismo. Si ya
    // viene resuelto desde el mapa de la sala (riesgoDeSala) no hace falta pedirlo de nuevo,
    // pero si el sidecart se abre para alguien que no está entrenando (ej. desde otra
    // pantalla) igual se busca acá.
    usersService.getRiesgo(userId).then(setRiesgoPropio).catch(() => setRiesgoPropio(null))
  }, [userId])

  const riesgo = riesgoDeSala || riesgoPropio
  const enRiesgo = riesgo?.risk_bucket === 'high_risk' || riesgo?.risk_bucket === 'risk'

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

          <div className={`rounded-lg p-3 ${enRiesgo ? 'bg-error/5' : 'bg-bg-surface'}`}>
            <RiesgoBadge riesgo={riesgo?.risk_bucket} dias={riesgo?.days_since_last_visit} mostrarSinDatos />
            {riesgoDeSala && enRiesgo && (
              <p className="text-xs text-text-secondary mt-1.5">
                Está entrenando ahora. Es el momento de hablarle.
              </p>
            )}
          </div>

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
  const { sedeId, sede } = useSede()
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [espera, setEspera] = useState([])
  const [riesgo, setRiesgo] = useState([])
  const [socioAbierto, setSocioAbierto] = useState(null)
  const [anotarAbierto, setAnotarAbierto] = useState(false)

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

  // El riesgo de cada uno cambia por día, pero QUIÉN está en la sala cambia a cada rato: se
  // vuelve a pedir cuando cambia la lista de espera y cada 30 s (los que rotan de box no
  // tocan la lista).
  useEffect(() => {
    const cargar = () =>
      hoyService.getRiesgoEnSala({ sedeId }).then(setRiesgo).catch((e) => {
        console.error('Error cargando el riesgo de la sala:', e)
        setRiesgo([])
      })
    cargar()
    const id = setInterval(cargar, 30000)
    return () => clearInterval(id)
  }, [sedeId, espera.length])

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
        <div className="flex items-center gap-2">
          {sedeId && (
            <a
              href={`/lista-espera/tv/sede/${sedeId}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary flex flex-col items-center gap-0.5 text-sm"
              title={sede?.name ? tvUrlSede(sede.name) : undefined}
            >
              <span>TV de sede</span>
              {sede?.name && (
                <span className="text-[10px] font-mono font-normal opacity-70">
                  {tvUrlSede(sede.name).replace('https://', '')}
                </span>
              )}
            </a>
          )}
          <button onClick={fetchLines} className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
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
            onAnotarSocio={() => setAnotarAbierto(true)}
          />
        </>
      )}

      <SocioSidecart
        userId={socioAbierto}
        onClose={() => setSocioAbierto(null)}
        riesgo={socioAbierto ? riesgoPorUsuario.get(socioAbierto) : null}
      />

      <AnotarSocioSidecart
        isOpen={anotarAbierto}
        onClose={() => setAnotarAbierto(false)}
        sedeId={sedeId}
        onAnotado={fetchEspera}
      />

      <Toaster position="top-right" />
    </div>
  )
}
