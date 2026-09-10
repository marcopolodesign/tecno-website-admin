import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  BanknotesIcon,
  LockOpenIcon,
  LockClosedIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline'
import { useSede } from '../contexts/SedeContext'
import { formatARS } from '../lib/dinero'
import hoyService from '../services/hoyService'
import cajaService from '../services/cajaService'
import QueueMonitor from './QueueMonitor'
import Sidecart from './Sidecart'

// La portada del día a día del gimnasio — lo primero que ve el dueño/staff al entrar.
//
// Orden definido por Mateo (2026-09-10), y cada salto tiene un porqué:
//   1. Alertas — arriba de todo. Son lo único que pide una acción hoy; abajo del fold nadie
//      las miraba, que es lo mismo que no tenerlas.
//   2. Estaciones y lista de espera (QueueMonitor tal cual) — el estado de la sala ahora.
//   3. Clases de prueba de hoy — arriba de asistidos: una clase de prueba es alguien que
//      todavía se puede perder, un asistido ya entró. Lo que se puede cambiar va primero.
//   4. Caja — el mostrador, que es donde vive recepción todo el día.
//   5. Asistidos hoy — registro, no decisión. Cierra la pantalla.
//
// Sin props: lee la sede del contexto global (useSede), igual que el resto de las pantallas
// que filtran por sede.
const MEMBERSHIP_EXPIRING_DAYS = 30

function waHref(phone) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}

function WhatsappLink({ phone }) {
  const href = waHref(phone)
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-success/10 transition-colors"
      title="Abrir WhatsApp"
    >
      <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
      </svg>
    </a>
  )
}

function formatTime(iso) {
  // 24 horas explícito: `es-AR` en Chrome devuelve 12 horas, y un gimnasio que abre a las 6
  // y cierra a las 23 lee "02:37" como la madrugada.
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-AR')
}

function ErrorNotice({ error }) {
  return (
    <div className="rounded-lg bg-error/5 p-4 flex items-start gap-2">
      <ExclamationTriangleIcon className="h-4 w-4 text-error flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-error">No se pudo cargar</p>
        <p className="text-xs text-text-secondary mt-0.5">{error.message}</p>
      </div>
    </div>
  )
}

function SectionCard({ title, subtitle, count, loading, error, isEmpty, emptyLabel, children }) {
  return (
    <div className="card border-0 shadow-none">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {subtitle && <p className="text-xs text-text-tertiary mt-0.5">{subtitle}</p>}
        </div>
        {!loading && !error && typeof count === 'number' && (
          <span className="text-2xl font-semibold text-text-primary">{count}</span>
        )}
      </div>
      {loading ? (
        <div className="h-20 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <ErrorNotice error={error} />
      ) : isEmpty ? (
        <p className="text-sm text-text-tertiary text-center py-6">{emptyLabel}</p>
      ) : (
        children
      )}
    </div>
  )
}

const ALERT_TONES = {
  warning: { chip: 'bg-warning/10 text-warning', icon: 'bg-warning/15 text-warning' },
  info: { chip: 'bg-info/10 text-info', icon: 'bg-info/15 text-info' },
  error: { chip: 'bg-error/10 text-error', icon: 'bg-error/15 text-error' },
}

function AlertCard({ tone, icon: Icon, loading, error, count, title, description, onClick }) {
  const t = ALERT_TONES[tone] || ALERT_TONES.info
  const clickable = !loading && !error && count > 0

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`card border-0 shadow-none text-left w-full flex items-start gap-3 transition-colors ${
        clickable ? 'cursor-pointer hover:brightness-[0.97]' : 'cursor-default'
      }`}
    >
      <div className={`p-2 rounded-lg shrink-0 ${t.icon}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="h-4 w-24 rounded bg-bg-surface animate-pulse" />
        ) : error ? (
          <p className="text-xs text-error">{error.message}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-text-primary">{title(count)}</p>
            {description && <p className="text-xs text-text-secondary mt-1">{description}</p>}
          </>
        )}
      </div>
      {clickable && <ChevronRightIcon className="h-5 w-5 text-text-tertiary shrink-0 mt-0.5" />}
    </button>
  )
}

const RIESGO_LABEL = { high_risk: 'Alto riesgo', risk: 'Riesgo' }
const EN_SALA_LABEL = { waiting: 'esperando turno', confirming: 'confirmando', in_box: 'entrenando' }

// Módulo de caja de la portada (pedido de Mateo, 2026-09-10): recepción trabaja todo el día
// en esta pantalla, y tener que irse a /caja para ver cuánto lleva el turno o cobrar algo es
// un viaje de ida y vuelta cada vez.
//
// Los botones no reimplementan la caja: llevan a /caja con el sidecart correspondiente ya
// abierto (`?accion=`). Es un click igual que si el botón viviera acá, y el motor de venta
// —cinco tablas en una transacción— queda con una sola implementación. Duplicarlo es
// exactamente lo que ya salió mal una vez.
//
// Nunca se muestra el efectivo esperado: el arqueo es a ciegas y `caja_resumen_turno` ni
// siquiera lo trae. Lo que se ve acá es lo vendido, que es otra cosa.
function CajaModulo({ turno, resumen, loading, error, enRiesgoEnSala }) {
  const hayAlerta = enRiesgoEnSala.length > 0

  return (
    <div className="card border-0 shadow-none">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Caja</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            {turno
              ? `Turno abierto por ${turno.abiertoPorSeller ? `${turno.abiertoPorSeller.firstName} ${turno.abiertoPorSeller.lastName}` : '—'} · desde ${formatTime(turno.abiertoAt)} · apertura ${formatARS(turno.montoInicial)}`
              : 'El mostrador del día'}
          </p>
        </div>
        <Link to="/caja" className="text-sm text-brand hover:underline shrink-0">
          Ver caja
        </Link>
      </div>

      {loading ? (
        <div className="h-20 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <ErrorNotice error={error} />
      ) : !turno ? (
        <div className="text-center py-6">
          <BanknotesIcon className="h-8 w-8 text-text-tertiary mx-auto mb-2" />
          <p className="text-sm text-text-primary font-medium">No hay una caja abierta</p>
          <p className="text-xs text-text-secondary mt-1 mb-4">Abrila para empezar a vender y cobrar</p>
          <Link to="/caja?accion=abrir" className="btn-primary inline-flex items-center gap-2">
            <LockOpenIcon className="h-4 w-4" />
            Abrir caja
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="rounded-lg bg-bg-surface p-3">
              <p className="text-xs text-text-tertiary">Total vendido</p>
              <p className="text-2xl font-semibold text-text-primary mt-0.5">
                {formatARS(resumen?.totalVendido ?? 0)}
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">
                {Number(resumen?.ventasCount ?? 0)} venta{Number(resumen?.ventasCount) === 1 ? '' : 's'}
              </p>
            </div>
            <div className="rounded-lg bg-bg-surface p-3">
              <p className="text-xs text-text-tertiary">Fiado del turno</p>
              <p className={`text-xl font-semibold mt-0.5 ${Number(resumen?.fiado ?? 0) > 0 ? 'text-warning' : 'text-text-primary'}`}>
                {formatARS(resumen?.fiado ?? 0)}
              </p>
            </div>
            <div className="rounded-lg bg-bg-surface p-3">
              <p className="text-xs text-text-tertiary">Ingresos / egresos</p>
              <p className="text-xl font-semibold text-text-primary mt-0.5">
                {formatARS(resumen?.ingresosExtra ?? 0)} / {formatARS(resumen?.egresos ?? 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-4">
            <Link to="/caja?accion=vender" className="btn-primary flex items-center gap-2">
              <ShoppingCartIcon className="h-4 w-4" />
              Vender
            </Link>
            <Link to="/caja?accion=movimiento" className="btn-secondary">
              Ingreso / Egreso
            </Link>
            <Link to="/caja?accion=cobrar" className="btn-secondary">
              Cobrar cuenta corriente
            </Link>
            <Link to="/caja?accion=cerrar" className="btn-secondary flex items-center gap-2">
              <LockClosedIcon className="h-4 w-4" />
              Cerrar caja
            </Link>
          </div>
        </>
      )}

      {/* Sólo si se da la condición: alguien que está en la sala AHORA y además viene con
          riesgo de no renovar. Es el único momento en que recepción lo tiene enfrente y
          puede hacer algo — mañana es una llamada, hoy es una conversación en el mostrador.
          Si no hay nadie así, el bloque no existe: una tarjeta vacía que dice "no hay nadie
          en riesgo" entrena a la gente a ignorar el lugar donde después sí aparece uno. */}
      {hayAlerta && (
        <div className="mt-4 rounded-lg bg-error/5 p-4">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-error shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-error">
                {enRiesgoEnSala.length === 1
                  ? 'Hay alguien en la sala con riesgo de no renovar'
                  : `Hay ${enRiesgoEnSala.length} personas en la sala con riesgo de no renovar`}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                Está acá ahora. Es el momento de hablarle.
              </p>
              <div className="space-y-1 mt-3">
                {enRiesgoEnSala.map((r) => (
                  <div key={r.userId} className="flex items-center justify-between gap-3 text-sm px-3 py-2 rounded-md bg-bg-surface">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-text-primary truncate">{r.nombre}</span>
                      <WhatsappLink phone={r.phone} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-text-tertiary">
                        {EN_SALA_LABEL[r.status] || 'en la sala'}
                        {r.daysSinceLastVisit != null ? ` · ${r.daysSinceLastVisit} días sin venir` : ''}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          r.riskBucket === 'high_risk' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'
                        }`}
                      >
                        {RIESGO_LABEL[r.riskBucket] || 'Riesgo'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Cada sidecart de alerta pide sus datos recién al abrirse — el resumen ya trajo el
// contador, no hace falta bajar las tres listas completas si nadie las mira.
function useLazyList(fetcher) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetcher()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [fetcher])

  return { data, loading, error, load }
}

export default function Hoy() {
  const { sedeId, sede } = useSede()

  const [resumen, setResumen] = useState(null)
  const [resumenLoading, setResumenLoading] = useState(true)
  const [resumenError, setResumenError] = useState(null)

  const [asistidos, setAsistidos] = useState([])
  const [asistidosLoading, setAsistidosLoading] = useState(true)
  const [asistidosError, setAsistidosError] = useState(null)

  const [clases, setClases] = useState([])
  const [clasesLoading, setClasesLoading] = useState(true)
  const [clasesError, setClasesError] = useState(null)

  const [caja, setCaja] = useState({ turno: null, resumen: null })
  const [cajaLoading, setCajaLoading] = useState(true)
  const [cajaError, setCajaError] = useState(null)

  // Estas dos se piden siempre, no de forma lazy como las listas de las alertas: el módulo
  // de caja necesita cruzarlas para saber si tiene que mostrar el aviso, y no se puede
  // decidir si mostrarlo sin tener las dos.
  const [enSala, setEnSala] = useState([])
  const [riesgo, setRiesgo] = useState([])

  const [activeSidecart, setActiveSidecart] = useState(null) // 'membresias' | 'leads' | 'riesgo' | null

  const membresiasList = useLazyList(useCallback(() => hoyService.getMembresiasPorVencer({ sedeId, days: MEMBERSHIP_EXPIRING_DAYS }), [sedeId]))
  const leadsList = useLazyList(useCallback(() => hoyService.getLeadsSinContactar({ sedeId }), [sedeId]))
  const riesgoList = useLazyList(useCallback(() => hoyService.getSociosEnRiesgo({ sedeId }), [sedeId]))

  const fetchResumen = useCallback(() => {
    setResumenLoading(true)
    setResumenError(null)
    hoyService
      .getResumen({ sedeId, membershipExpiringDays: MEMBERSHIP_EXPIRING_DAYS })
      .then(setResumen)
      .catch(setResumenError)
      .finally(() => setResumenLoading(false))
  }, [sedeId])

  const fetchAsistidos = useCallback(() => {
    setAsistidosLoading(true)
    setAsistidosError(null)
    hoyService
      .getAsistidosHoy({ sedeId })
      .then(setAsistidos)
      .catch(setAsistidosError)
      .finally(() => setAsistidosLoading(false))
  }, [sedeId])

  const fetchCaja = useCallback(() => {
    if (!sedeId) {
      setCaja({ turno: null, resumen: null })
      setCajaLoading(false)
      return
    }
    setCajaLoading(true)
    setCajaError(null)
    cajaService
      .getTurnoAbierto(sedeId)
      .then(async (turno) => {
        const resumen = turno ? await cajaService.resumenTurno(turno.id) : null
        setCaja({ turno, resumen })
      })
      .catch(setCajaError)
      .finally(() => setCajaLoading(false))
  }, [sedeId])

  // El aviso de "está acá y se está por ir" sale del cruce de dos cosas que ya existían por
  // separado y nunca se habían mirado juntas. Si cualquiera de las dos falla, el aviso
  // simplemente no aparece: es información extra, no puede tirar abajo la portada.
  const fetchRiesgoEnSala = useCallback(() => {
    hoyService.getEnSalaAhora({ sedeId }).then(setEnSala).catch(() => setEnSala([]))
    hoyService.getSociosEnRiesgo({ sedeId }).then(setRiesgo).catch(() => setRiesgo([]))
  }, [sedeId])

  const fetchClases = useCallback(() => {
    setClasesLoading(true)
    setClasesError(null)
    hoyService
      .getClasesPruebaHoy({ sedeId })
      .then(setClases)
      .catch(setClasesError)
      .finally(() => setClasesLoading(false))
  }, [sedeId])

  useEffect(() => {
    fetchResumen()
    fetchAsistidos()
    fetchClases()
    fetchCaja()
    fetchRiesgoEnSala()
  }, [fetchResumen, fetchAsistidos, fetchClases, fetchCaja, fetchRiesgoEnSala])

  const enRiesgoEnSala = useMemo(() => {
    if (enSala.length === 0 || riesgo.length === 0) return []
    const porUsuario = new Map(riesgo.map((r) => [r.user_id, r]))
    // Una misma persona no puede aparecer dos veces aunque tenga más de una entrada en la
    // cola (pasa si se saltea un box y vuelve a entrar).
    const porPersona = new Map()
    enSala.forEach((p) => {
      const r = porUsuario.get(p.userId)
      if (!r || porPersona.has(p.userId)) return
      porPersona.set(p.userId, {
        ...p,
        phone: p.phone ?? r.phone ?? null,
        riskBucket: r.risk_bucket,
        daysSinceLastVisit: r.days_since_last_visit,
      })
    })
    return [...porPersona.values()]
  }, [enSala, riesgo])

  const openSidecart = (key, list) => {
    setActiveSidecart(key)
    if (!list.data) list.load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Hoy</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          {sede?.name ? ` · ${sede.name}` : ''}
        </p>
      </div>

      {/* 1. Alertas — lo único que pide una acción hoy, así que va arriba de todo.
          Cada una abre la lista filtrada correspondiente. */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Alertas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AlertCard
            tone="warning"
            icon={CalendarDaysIcon}
            loading={resumenLoading}
            error={resumenError}
            count={resumen?.membresias_por_vencer_count ?? 0}
            title={(n) => `${n} membresía${n !== 1 ? 's' : ''} por vencer`}
            description={`Vencen en los próximos ${resumen?.membership_expiring_window_days ?? MEMBERSHIP_EXPIRING_DAYS} días.`}
            onClick={() => openSidecart('membresias', membresiasList)}
          />
          <AlertCard
            tone="info"
            icon={PhoneIcon}
            loading={resumenLoading}
            error={resumenError}
            count={resumen?.leads_sin_contactar_count ?? 0}
            title={(n) => `${n} lead${n !== 1 ? 's' : ''} esperando contacto`}
            description="Leads nuevos que todavía no fueron contactados."
            onClick={() => openSidecart('leads', leadsList)}
          />
          <AlertCard
            tone="error"
            icon={ExclamationTriangleIcon}
            loading={resumenLoading}
            error={resumenError}
            count={resumen?.socios_en_riesgo_count ?? 0}
            title={(n) => `${n} socio${n !== 1 ? 's' : ''} en riesgo de no renovar`}
            description="Socios activos con baja frecuencia de asistencia (riesgo o alto riesgo de abandono)."
            onClick={() => openSidecart('riesgo', riesgoList)}
          />
        </div>
      </div>

      {/* 2. Estado de la sala ahora mismo: estaciones y, dentro de cada línea, la lista de
          espera debajo — QueueMonitor ya trae ambas en ese orden con Realtime, no hace
          falta reimplementarlo. */}
      <QueueMonitor />

      {/* 3. Clases de prueba de hoy — arriba de asistidos: todavía se pueden perder. */}
      <SectionCard
        title="Clases de prueba hoy"
        subtitle="Leads con clase de prueba agendada para hoy"
        count={clasesLoading || clasesError ? undefined : clases.length}
        loading={clasesLoading}
        error={clasesError}
        isEmpty={!clasesLoading && !clasesError && clases.length === 0}
        emptyLabel="No hay clases de prueba agendadas para hoy."
      >
        <div className="space-y-1">
          {clases.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-md bg-bg-surface gap-3">
              <div className="min-w-0">
                <p className="text-text-primary truncate">
                  {c.first_name} {c.last_name}
                </p>
                {c.trial_class_coach && (
                  <p className="text-xs text-text-tertiary truncate">
                    Coach: {c.trial_class_coach.first_name} {c.trial_class_coach.last_name}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-text-tertiary text-xs">{formatTime(c.trial_class_scheduled_at)}</span>
                {c.trial_class_attended_at ? (
                  <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
                    <CheckCircleIcon className="h-3.5 w-3.5" /> Asistió
                  </span>
                ) : (
                  <span className="text-xs text-text-tertiary">Pendiente</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 4. Caja — el mostrador. Recepción vive en esta pantalla; el módulo evita el viaje
          de ida y vuelta a /caja para cada operación. */}
      <CajaModulo
        turno={caja.turno}
        resumen={caja.resumen}
        loading={cajaLoading}
        error={cajaError}
        enRiesgoEnSala={enRiesgoEnSala}
      />

      {/* 5. Asistidos hoy — registro del día, no decisión: cierra la pantalla. */}
      <SectionCard
        title="Asistidos hoy"
        subtitle="Ingresos confirmados en el kiosko"
        count={asistidosLoading || asistidosError ? undefined : asistidos.length}
        loading={asistidosLoading}
        error={asistidosError}
        isEmpty={!asistidosLoading && !asistidosError && asistidos.length === 0}
        emptyLabel="Todavía no hay ingresos registrados hoy."
      >
        {/* Los últimos que entraron, no todos: una caja con scroll propio en el medio de la
            portada se come la rueda del mouse y deja al que scrollea trabado sobre una lista
            que no estaba mirando. El resto vive en Accesos, que es la pantalla de eso. */}
        <div className="space-y-1">
          {asistidos.slice(0, 6).map((a) => (
            <div key={a.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-md bg-bg-surface">
              <span className="text-text-primary">
                {a.users ? `${a.users.first_name} ${a.users.last_name}` : 'Socio'}
              </span>
              <span className="text-text-tertiary text-xs">{formatTime(a.scanned_at)}</span>
            </div>
          ))}
        </div>
        {asistidos.length > 6 && (
          <Link to="/access-logs" className="mt-3 inline-block text-sm text-brand hover:underline">
            Ver los {asistidos.length} ingresos de hoy
          </Link>
        )}
      </SectionCard>

      {/* Sidecart: membresías por vencer */}
      <Sidecart
        isOpen={activeSidecart === 'membresias'}
        onClose={() => setActiveSidecart(null)}
        title="Membresías por vencer"
        subtitle={`Vencen en los próximos ${MEMBERSHIP_EXPIRING_DAYS} días`}
      >
        {membresiasList.loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : membresiasList.error ? (
          <ErrorNotice error={membresiasList.error} />
        ) : (
          <div className="space-y-2">
            {(membresiasList.data || []).map((m) => {
              const days = Math.ceil((new Date(m.end_date) - new Date()) / (1000 * 60 * 60 * 24))
              return (
                <div key={m.id} className="card border-0 shadow-none">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {m.users?.first_name} {m.users?.last_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-text-tertiary">Vence: {formatDate(m.end_date)}</p>
                        <WhatsappLink phone={m.users?.phone} />
                      </div>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${days <= 7 ? 'text-error' : 'text-warning'}`}>
                      {days}d
                    </span>
                  </div>
                </div>
              )
            })}
            {(membresiasList.data || []).length === 0 && (
              <p className="text-sm text-text-tertiary text-center py-8">No hay membresías por vencer.</p>
            )}
          </div>
        )}
      </Sidecart>

      {/* Sidecart: leads sin contactar */}
      <Sidecart
        isOpen={activeSidecart === 'leads'}
        onClose={() => setActiveSidecart(null)}
        title="Leads esperando contacto"
        subtitle="Estado: nuevo"
      >
        {leadsList.loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : leadsList.error ? (
          <ErrorNotice error={leadsList.error} />
        ) : (
          <div className="space-y-2">
            {(leadsList.data || []).map((l) => (
              <div key={l.id} className="card border-0 shadow-none">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {l.first_name} {l.last_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-text-tertiary">{formatDate(l.created_at)}</p>
                      {l.source && <p className="text-xs text-text-tertiary capitalize">· {l.source}</p>}
                      <WhatsappLink phone={l.phone} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(leadsList.data || []).length === 0 && (
              <p className="text-sm text-text-tertiary text-center py-8">No hay leads sin contactar.</p>
            )}
          </div>
        )}
      </Sidecart>

      {/* Sidecart: socios en riesgo */}
      <Sidecart
        isOpen={activeSidecart === 'riesgo'}
        onClose={() => setActiveSidecart(null)}
        title="Socios en riesgo de no renovar"
        subtitle="Mismo criterio que Métricas de negocio → Predicción de abandono"
      >
        {riesgoList.loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : riesgoList.error ? (
          <ErrorNotice error={riesgoList.error} />
        ) : (
          <div className="space-y-2">
            {(riesgoList.data || []).map((r) => (
              <div key={r.user_id} className="card border-0 shadow-none">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{r.user_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-text-tertiary">
                        {r.days_since_last_visit != null ? `${r.days_since_last_visit} días sin venir` : 'Sin ingresos registrados'}
                      </p>
                      <WhatsappLink phone={r.phone} />
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                      r.risk_bucket === 'high_risk' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'
                    }`}
                  >
                    {r.risk_bucket === 'high_risk' ? 'Alto riesgo' : 'Riesgo'}
                  </span>
                </div>
              </div>
            ))}
            {(riesgoList.data || []).length === 0 && (
              <p className="text-sm text-text-tertiary text-center py-8">No hay socios en riesgo.</p>
            )}
          </div>
        )}
      </Sidecart>
    </div>
  )
}
