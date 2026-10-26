import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  UserGroupIcon,
  PhoneIcon,
  ChartBarIcon,
  UserCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { CurrencyDollarIcon, ArrowTrendingUpIcon, UsersIcon as UsersIconSolid } from '@heroicons/react/24/solid'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useSede } from '../contexts/SedeContext'
import { leadsService } from '../services/leadsService'
import { prospectsService } from '../services/prospectsService'
import { usersService } from '../services/usersService'
import paymentsService from '../services/paymentsService'
import membershipsService from '../services/membershipsService'
import businessMetricsService from '../services/businessMetricsService'
import cajaService from '../services/cajaService'
import { BUSINESS_METRICS_REGISTRY } from '../config/businessMetricsCharts'
import BenchmarksPanel from './business-metrics/BenchmarksPanel'
import { PERIOD_PRESETS, CUSTOM_PERIOD_ID, resolvePeriod, etiquetaDePeriodo } from '../utils/metricPeriods'

// Dashboard + Métricas de negocio, unificados (pedido de Mateo, Sprint 3½): una sola
// pantalla para "¿cómo viene el negocio?" en vez de repartir el pulso general y el detalle
// por persona en dos lugares separados. Ver informe de la tarea para el detalle de qué se
// fusionó, qué se sacó y qué quedó con ventana fija.
//
// Regla de esta pantalla: el filtro de período (arriba a la derecha) manda sobre todo lo
// que se pueda recalcular por rango de fechas. Lo que no se puede —conteos de "estado
// actual" como socios por tipo de membresía, o alertas de "esto necesita atención ya"
// como vencimientos próximos y leads sin contactar— queda con su propia ventana y lo dice
// explícitamente en el subtítulo, para que no parezca que responde al filtro cuando no lo
// hace.

const COL_SPAN_CLASS = {
  4: 'lg:col-span-4',
  6: 'lg:col-span-6',
  12: 'lg:col-span-12',
}

// Mismo mapeo que Leads.jsx — el enum real en Postgres es inglés (lead_status: new,
// contacted, qualified, negotiating, converted, lost). El Dashboard viejo comparaba contra
// literales en español ('nuevo', 'contactado'...) que nunca matcheaban nada: la alerta de
// "leads sin contactar" y los contadores de pipeline estaban silenciosamente rotos (siempre
// en 0 / undefined). Se corrige acá.
const STATUS_META = {
  new: { badge: 'status-nuevo', label: 'Nuevo' },
  contacted: { badge: 'status-contactado', label: 'Contactado' },
  qualified: { badge: 'bg-bg-surface text-text-secondary', label: 'Calificado' },
  negotiating: { badge: 'bg-bg-surface text-text-secondary', label: 'Negociando' },
  converted: { badge: 'status-convertido', label: 'Convertido' },
  lost: { badge: 'status-perdido', label: 'Perdido' },
}
const getStatusBadgeClass = (status) => STATUS_META[status]?.badge || 'bg-bg-surface text-text-secondary'
const getStatusLabel = (status) => STATUS_META[status]?.label || status || 'N/A'

const MEMBERSHIP_TYPE_CONFIG = {
  wellhub: {
    label: 'Wellhub',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-500',
  },
  sportclub: {
    label: 'SportClub',
    bgColor: 'bg-info/10',
    textColor: 'text-info',
  },
  socio_fundador: {
    label: 'Socios Fundadores',
    bgColor: 'bg-warning/10',
    textColor: 'text-warning',
  },
  free: {
    label: 'Free',
    bgColor: 'bg-gray-500/10',
    textColor: 'text-gray-500',
  },
}

const getMembershipStatusColor = (status) => {
  switch (status) {
    case 'active': return 'status-convertido'
    case 'expired': return 'status-contactado'
    case 'cancelled': return 'status-perdido'
    default: return 'bg-bg-surface text-text-secondary'
  }
}
const getMembershipStatusLabel = (status) => {
  switch (status) {
    case 'active': return 'Activo'
    case 'expired': return 'Vencido'
    case 'cancelled': return 'Cancelado'
    default: return status || 'N/A'
  }
}

// true si dateStr cae dentro de [start, end] (fechas YYYY-MM-DD). start/end null = todo el
// historial, no filtra nada.
function inPeriod(dateStr, start, end) {
  if (!start || !end) return true
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d >= new Date(`${start}T00:00:00`) && d <= new Date(`${end}T23:59:59`)
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-border-default rounded-md px-3 py-2 shadow-lg">
        <p className="text-text-primary text-sm font-medium">{label}</p>
        <p className="text-brand text-sm">{payload[0].value}</p>
      </div>
    )
  }
  return null
}

const WhatsAppIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
)

export default function BusinessOverview() {
  const { sedeId, sede } = useSede()

  // Período — mismo selector que tenía Métricas de negocio. Manda sobre todo lo que se
  // pueda recalcular por rango de fechas en esta pantalla.
  const [periodId, setPeriodId] = useState('last_30')
  const [rangoCustom, setRangoCustom] = useState({ start: '', end: '' })
  const { start, end } = resolvePeriod(periodId, rangoCustom)

  const [benchmarks, setBenchmarks] = useState({})
  const [benchmarksVersion, setBenchmarksVersion] = useState(0)

  const [users, setUsers] = useState([])
  const [prospects, setProspects] = useState([])
  const [leads, setLeads] = useState([])
  const [revenueStats, setRevenueStats] = useState({
    totalRevenue: 0, newCustomersRevenue: 0, renewalsRevenue: 0,
    newCustomersCount: 0, renewalsCount: 0, byMembershipType: {}
  })
  // Desglose de ingresos por concepto (mostrador + otros canales). Vive aparte de
  // `revenueStats` porque ése sólo mira `payments`: la plata que entra por caja no pasa por
  // ahí, así que el total de arriba se toma de esta RPC y no de la suma de pagos.
  const [ingresosPorConcepto, setIngresosPorConcepto] = useState([])
  const [expiringMemberships, setExpiringMemberships] = useState([])
  const [loading, setLoading] = useState(true)

  const [showExpiringSidecart, setShowExpiringSidecart] = useState(false)
  const [showUncontactedSidecart, setShowUncontactedSidecart] = useState(false)
  const [showMembershipTypeSidecart, setShowMembershipTypeSidecart] = useState(false)
  const [selectedMembershipType, setSelectedMembershipType] = useState(null)

  const loadBenchmarks = useCallback(() => {
    businessMetricsService
      .getBenchmarks()
      .then((rows) => {
        const map = {}
        rows.forEach((r) => { map[r.metric_key] = r.target_value })
        setBenchmarks(map)
      })
      .catch(() => {
        // Igual que en Métricas de negocio: si falla, los charts de abajo simplemente no
        // dibujan línea de benchmark — no rompe el resto de la pantalla.
      })
  }, [])
  useEffect(() => { loadBenchmarks() }, [loadBenchmarks, benchmarksVersion])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.allSettled([
      usersService.getUsers(sedeId),
      prospectsService.getProspects(sedeId),
      leadsService.getLeads(sedeId),
      paymentsService.getRevenueStats(start, end, sedeId),
      membershipsService.getExpiringMemberships(30, sedeId),
      cajaService.ingresosPorConcepto({ locationId: sedeId || null, desde: start, hasta: end }),
    ]).then(([usersR, prospectsR, leadsR, revenueR, expiringR, conceptosR]) => {
      if (cancelled) return
      setUsers(usersR.status === 'fulfilled' ? (usersR.value.data || []) : [])
      setProspects(prospectsR.status === 'fulfilled' ? (prospectsR.value.data || []) : [])
      setLeads(leadsR.status === 'fulfilled' ? (leadsR.value.data || []) : [])
      setRevenueStats(revenueR.status === 'fulfilled' ? (revenueR.value.data || {}) : {})
      setExpiringMemberships(expiringR.status === 'fulfilled' ? (expiringR.value.data || []) : [])
      setIngresosPorConcepto(conceptosR.status === 'fulfilled' ? (conceptosR.value || []) : [])
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [sedeId, start, end])

  // Estado actual (no depende del período): cuántos clientes hay hoy, por tipo de
  // membresía. Una membresía activa no es un evento con fecha en el período — es una foto
  // de ahora — así que period no la filtra; se aclara en el subtítulo de la sección.
  const snapshotStats = useMemo(() => ({
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.membershipStatus === 'active').length,
    wellhubUsers: users.filter((u) => u.membershipType === 'wellhub').length,
    sportclubUsers: users.filter((u) => u.membershipType === 'sportclub').length,
    foundingMembers: users.filter((u) => u.membershipType === 'socio_fundador').length,
    freeUsers: users.filter((u) => u.membershipType === 'free').length,
  }), [users])

  // Recorte por período: prospectos/leads/usuarios que entraron en el rango elegido —
  // alimenta el embudo y el pipeline de leads de abajo.
  const periodProspects = useMemo(() => prospects.filter((p) => inPeriod(p.createdAt, start, end)), [prospects, start, end])
  const periodLeads = useMemo(() => leads.filter((l) => inPeriod(l.createdAt, start, end)), [leads, start, end])
  const periodUsers = useMemo(() => users.filter((u) => inPeriod(u.createdAt, start, end)), [users, start, end])

  const leadsByStatus = useMemo(() => ({
    new: periodLeads.filter((l) => l.status === 'new').length,
    contacted: periodLeads.filter((l) => l.status === 'contacted').length,
    converted: periodLeads.filter((l) => l.status === 'converted').length,
  }), [periodLeads])

  const conversionRate = periodProspects.length > 0
    ? Math.round((periodUsers.length / periodProspects.length) * 100)
    : 0

  const funnelData = useMemo(() => [
    { name: 'Prospectos', value: periodProspects.length, color: '#3b82f6' },
    { name: 'Leads', value: periodLeads.length, color: '#f59e0b' },
    { name: 'Usuarios', value: periodUsers.length, color: '#10b981' },
  ], [periodProspects, periodLeads, periodUsers])

  const recentLeads = useMemo(() => periodLeads.slice(0, 5), [periodLeads])

  // "Leads sin contactar" es una alerta de estado actual (recepción tiene una tarea
  // pendiente ahora), no un evento del período — por eso mira `leads` completo, sede
  // filtrada, sin recorte de fecha.
  const uncontactedLeads = useMemo(() => leads.filter((l) => l.status === 'new'), [leads])

  const handleMembershipTypeClick = (type) => {
    setSelectedMembershipType(type)
    setShowMembershipTypeSidecart(true)
  }
  const filteredUsersByType = selectedMembershipType
    ? users.filter((u) => u.membershipType === selectedMembershipType)
    : []
  const selectedTypeConfig = selectedMembershipType ? MEMBERSHIP_TYPE_CONFIG[selectedMembershipType] : null

  const ctx = { sedeId, start, end, benchmarks }
  // Total del período = lo que devuelve la RPC de conceptos, no la suma de `payments`:
  // incluye lo cobrado por mostrador y descuenta lo que quedó fiado. Los conceptos en cero
  // no se muestran — una fila "$0" sólo ocupa lugar.
  const ingresos = useMemo(() => {
    const filas = ingresosPorConcepto.filter((r) => r.total > 0 || r.cantidad > 0)
    return {
      filas,
      total: ingresosPorConcepto.reduce((acc, r) => acc + r.total, 0),
      cantidad: ingresosPorConcepto.reduce((acc, r) => acc + r.cantidad, 0),
    }
  }, [ingresosPorConcepto])

  const periodoLabel = etiquetaDePeriodo(periodId, rangoCustom)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header + selector de período */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Negocio</h1>
          <p className="text-sm text-text-secondary mt-1">
            {sede ? sede.name : 'Todas las sedes'} · cómo viene el negocio, de lo general a la trazabilidad por coach y por recepción
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {[...PERIOD_PRESETS, { id: CUSTOM_PERIOD_ID, label: 'Rango a medida' }].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodId(p.id)}
                className={
                  p.id === periodId
                    ? 'status-badge bg-brand/10 text-brand'
                    : 'status-badge bg-bg-surface text-text-secondary hover:bg-bg-surface-hover transition-colors'
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodId === CUSTOM_PERIOD_ID && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="date"
                value={rangoCustom.start}
                max={rangoCustom.end || undefined}
                onChange={(e) => setRangoCustom((r) => ({ ...r, start: e.target.value }))}
                className="input-field py-1 px-2 text-xs"
                aria-label="Desde"
              />
              <span>a</span>
              <input
                type="date"
                value={rangoCustom.end}
                min={rangoCustom.start || undefined}
                onChange={(e) => setRangoCustom((r) => ({ ...r, end: e.target.value }))}
                className="input-field py-1 px-2 text-xs"
                aria-label="Hasta"
              />
              {(!rangoCustom.start || !rangoCustom.end) && (
                <span className="text-text-tertiary">— mientras falte una fecha se muestra todo el historial</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Clientes por tipo de membresía — estado actual, a hoy, no responde al período */}
      <div>
        <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Clientes a hoy · no cambia con el período</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card border-0 shadow-none">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-brand/10 rounded-lg">
                <UserGroupIcon className="h-5 w-5 text-brand" />
              </div>
              <div>
                <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Total Clientes</p>
                <p className="text-2xl font-semibold text-text-primary">{snapshotStats.totalUsers}</p>
                <p className="text-xs text-text-tertiary mt-0.5">{snapshotStats.activeUsers} activos</p>
              </div>
            </div>
          </div>

          <div
            className="card border-0 shadow-none cursor-pointer hover:bg-bg-surface transition-colors"
            onClick={() => handleMembershipTypeClick('wellhub')}
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <UserCircleIcon className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Wellhub</p>
                <p className="text-2xl font-semibold text-text-primary">{snapshotStats.wellhubUsers}</p>
                <p className="text-xs text-text-tertiary mt-0.5">Gympass</p>
              </div>
              <svg className="h-5 w-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          <div
            className="card border-0 shadow-none cursor-pointer hover:bg-bg-surface transition-colors"
            onClick={() => handleMembershipTypeClick('sportclub')}
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-info/10 rounded-lg">
                <UserCircleIcon className="h-5 w-5 text-info" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">SportClub</p>
                <p className="text-2xl font-semibold text-text-primary">{snapshotStats.sportclubUsers}</p>
                <p className="text-xs text-text-tertiary mt-0.5">Socios</p>
              </div>
              <svg className="h-5 w-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          <div
            className="card border-0 shadow-none cursor-pointer hover:bg-bg-surface transition-colors"
            onClick={() => handleMembershipTypeClick('socio_fundador')}
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-warning/10 rounded-lg">
                <UserCircleIcon className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Fundadores</p>
                <p className="text-2xl font-semibold text-text-primary">{snapshotStats.foundingMembers}</p>
                <p className="text-xs text-text-tertiary mt-0.5">Socios fundadores</p>
              </div>
              <svg className="h-5 w-5 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Ingresos — sí responde al período elegido arriba */}
      <div className="card border-0 shadow-none bg-linear-to-br from-brand/5 to-brand/10">
        <div className="flex items-center gap-2 mb-4">
          <CurrencyDollarIcon className="h-5 w-5 text-brand" />
          <h2 className="text-sm font-semibold text-text-primary">Ingresos — {periodoLabel}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-bg-secondary/50 rounded-lg p-4">
            <p className="text-xs font-medium text-text-tertiary mb-1">Ingresos Totales</p>
            <p className="text-2xl font-semibold text-brand">
              ${ingresos.total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              {ingresos.cantidad} cobros · mostrador y otros canales
            </p>
          </div>

          <div className="bg-bg-secondary/50 rounded-lg p-4">
            <p className="text-xs font-medium text-text-tertiary mb-1 flex items-center gap-1">
              <UsersIconSolid className="h-3 w-3 text-info" />
              Clientes Nuevos
            </p>
            <p className="text-xl font-semibold text-info">
              ${revenueStats.newCustomersRevenue?.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
            </p>
            <p className="text-xs text-text-tertiary mt-1">{revenueStats.newCustomersCount || 0} clientes</p>
          </div>

          <div className="bg-bg-secondary/50 rounded-lg p-4">
            <p className="text-xs font-medium text-text-tertiary mb-1 flex items-center gap-1">
              <ArrowTrendingUpIcon className="h-3 w-3 text-purple-500" />
              Renovaciones
            </p>
            <p className="text-xl font-semibold text-purple-400">
              ${revenueStats.renewalsRevenue?.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
            </p>
            <p className="text-xs text-text-tertiary mt-1">{revenueStats.renewalsCount || 0} renovaciones</p>
          </div>
        </div>

        {ingresos.filas.length > 0 && (
          <div className="mt-4 bg-bg-secondary/50 rounded-lg p-4">
            <p className="text-xs font-semibold text-text-secondary mb-3">De dónde vino la plata</p>
            <div className="space-y-2">
              {ingresos.filas.map((fila) => (
                <div key={fila.concepto} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">
                    {fila.concepto}
                    <span className="text-text-tertiary text-xs ml-2">
                      {fila.cantidad} {fila.cantidad === 1 ? 'cobro' : 'cobros'}
                    </span>
                  </span>
                  <span className="font-medium text-text-primary">
                    ${fila.total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.keys(revenueStats.byMembershipType || {}).length > 0 && (
          <div className="mt-4 bg-bg-secondary/50 rounded-lg p-4">
            <p className="text-xs font-semibold text-text-secondary mb-3">Ingresos por Tipo de Membresía</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(revenueStats.byMembershipType).map(([type, data]) => (
                <div key={type} className="text-center">
                  <p className="text-xs text-text-tertiary capitalize mb-1">{type}</p>
                  <p className="text-sm font-semibold text-text-primary">
                    ${data.revenue?.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
                  </p>
                  <p className="text-xs text-text-muted">{data.count} pagos</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Alertas — estado actual / a futuro, tampoco responden al período */}
      {expiringMemberships.length > 0 && (
        <div
          className="card border-0 shadow-none bg-warning/5 cursor-pointer hover:bg-warning/10 transition-colors"
          onClick={() => setShowExpiringSidecart(true)}
        >
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-warning/10 rounded">
              <svg className="h-4 w-4 text-warning" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-warning">
                {expiringMemberships.length} membresía{expiringMemberships.length > 1 ? 's' : ''} por vencer
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Vencen en los próximos 30 días desde hoy (no depende del período elegido arriba). Hacé clic para ver el detalle.
              </p>
            </div>
            <div className="text-text-tertiary">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {uncontactedLeads.length > 0 && (
        <div
          className="card border-0 shadow-none bg-info/5 cursor-pointer hover:bg-info/10 transition-colors"
          onClick={() => setShowUncontactedSidecart(true)}
        >
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-info/10 rounded">
              <PhoneIcon className="h-4 w-4 text-info" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-info">
                {uncontactedLeads.length} lead{uncontactedLeads.length > 1 ? 's' : ''} sin contactar
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Pendientes ahora, de cualquier fecha (no depende del período elegido arriba). Hacé clic para ver el detalle.
              </p>
            </div>
            <div className="text-text-tertiary">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline de leads del período + embudo */}
      <div>
        <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Pipeline — {periodoLabel}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card border-0 shadow-none">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-info/10 rounded-lg flex items-center justify-center">
                <span className="text-info font-semibold text-sm">N</span>
              </div>
              <div>
                <p className="text-xs font-medium text-text-tertiary">Leads Nuevos</p>
                <p className="text-lg font-semibold text-text-primary">{leadsByStatus.new}</p>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-none">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-warning/10 rounded-lg flex items-center justify-center">
                <PhoneIcon className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="text-xs font-medium text-text-tertiary">Contactados</p>
                <p className="text-lg font-semibold text-text-primary">{leadsByStatus.contacted}</p>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-none">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-brand/10 rounded-lg flex items-center justify-center">
                <ChartBarIcon className="h-4 w-4 text-brand" />
              </div>
              <div>
                <p className="text-xs font-medium text-text-tertiary">Convertidos</p>
                <p className="text-lg font-semibold text-text-primary">{leadsByStatus.converted}</p>
              </div>
            </div>
          </div>

          <div className="card border-0 shadow-none">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <ArrowTrendingUpIcon className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-text-tertiary">Tasa General</p>
                <p className="text-lg font-semibold text-text-primary">{conversionRate}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card border-0 shadow-none">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Embudo de Conversión — {periodoLabel}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={{ stroke: '#e5e7eb' }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={{ stroke: '#e5e7eb' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar isAnimationActive={false} dataKey="value" radius={[4, 4, 0, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card border-0 shadow-none">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Actividad Reciente — {periodoLabel}</h3>
          <div className="space-y-2">
            {recentLeads.length === 0 ? (
              <p className="text-sm text-text-tertiary text-center py-8">
                No hay leads en el período elegido.
              </p>
            ) : (
              recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-3 bg-bg-surface rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-warning/10 rounded-full flex items-center justify-center">
                      <span className="text-warning font-medium text-sm">
                        {lead.firstName?.charAt(0) || 'L'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {lead.firstName || 'N/A'} {lead.lastName || ''}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        Lead · {getStatusLabel(lead.status)}
                      </p>
                    </div>
                  </div>
                  <span className={`status-badge ${getStatusBadgeClass(lead.status)}`}>
                    {getStatusLabel(lead.status)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Detalle por persona — trazabilidad a coach y a quien recibió en recepción */}
      <div>
        <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">Detalle por coach y por recepción — {periodoLabel}</p>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {BUSINESS_METRICS_REGISTRY.map((chart) => (
            <div key={chart.id} className={`col-span-1 ${COL_SPAN_CLASS[chart.colSpan] || 'lg:col-span-6'}`}>
              <chart.component {...chart.getProps(ctx)} />
            </div>
          ))}
        </div>
      </div>

      <BenchmarksPanel onChange={() => setBenchmarksVersion((v) => v + 1)} />

      {/* Expiring Memberships Sidecart */}
      {showExpiringSidecart && (
        <>
          <div
            className="fixed inset-0 bg-white/70 backdrop-blur-[2px] z-40 transition-opacity"
            onClick={() => setShowExpiringSidecart(false)}
          />
          <div className="fixed inset-0 sm:inset-y-4 sm:right-4 sm:left-auto w-full sm:max-w-3xl bg-white sm:rounded-2xl z-50 flex flex-col overflow-hidden animate-slide-in-right shadow-[0_10px_40px_-12px_rgba(17,24,39,0.18)] ring-1 ring-black/5">
            <div className="flex items-center justify-between p-6 border-b border-border-default">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">Membresías por Vencer</h2>
                <p className="text-sm text-text-secondary mt-1">
                  {expiringMemberships.length} membresía{expiringMemberships.length > 1 ? 's' : ''} vencen en los próximos 30 días
                </p>
              </div>
              <button onClick={() => setShowExpiringSidecart(false)} className="p-2 hover:bg-bg-surface rounded-lg transition-colors">
                <XMarkIcon className="h-6 w-6 text-text-secondary" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {expiringMemberships.map((membership) => {
                  const daysUntilExpiry = Math.ceil((new Date(membership.endDate) - new Date()) / (1000 * 60 * 60 * 24))
                  const isUrgent = daysUntilExpiry <= 7
                  return (
                    <div key={membership.id} className={`card border-0 shadow-none ${isUrgent ? 'bg-error/5' : 'bg-warning/5'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`h-10 w-10 rounded-full ${isUrgent ? 'bg-error/20' : 'bg-warning/20'} flex items-center justify-center shrink-0`}>
                            <span className={`text-sm font-semibold ${isUrgent ? 'text-error' : 'text-warning'}`}>
                              {membership.users?.firstName?.charAt(0) || 'U'}
                              {membership.users?.lastName?.charAt(0) || ''}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-text-primary truncate">
                              {membership.users?.firstName} {membership.users?.lastName}
                            </h3>
                            <p className="text-xs text-text-secondary truncate">{membership.users?.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-text-muted">{membership.users?.phone}</p>
                              {membership.users?.phone && (
                                <a
                                  href={`https://wa.me/${membership.users.phone.replace(/\D/g, '')}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-success/10 transition-colors"
                                  title="Abrir WhatsApp"
                                >
                                  <WhatsAppIcon className="w-4 h-4 text-success" />
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-bg-surface text-text-secondary capitalize">
                                {membership.membershipType}
                              </span>
                              <span className={`text-xs font-medium ${isUrgent ? 'text-error' : 'text-warning'}`}>
                                Vence: {new Date(membership.endDate).toLocaleDateString('es-AR')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg ${isUrgent ? 'bg-error/10' : 'bg-warning/10'}`}>
                          <span className={`text-2xl font-bold ${isUrgent ? 'text-error' : 'text-warning'}`}>{daysUntilExpiry}</span>
                          <span className={`text-xs ${isUrgent ? 'text-error' : 'text-warning'}`}>día{daysUntilExpiry !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {expiringMemberships.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-text-secondary">No hay membresías por vencer</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-border-default bg-bg-surface">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-error/20" />
                    <span className="text-text-secondary">Urgente (≤7 días)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-warning/20" />
                    <span className="text-text-secondary">Próximo (8-30 días)</span>
                  </div>
                </div>
                <button onClick={() => setShowExpiringSidecart(false)} className="btn-secondary">Cerrar</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Uncontacted Leads Sidecart */}
      {showUncontactedSidecart && (
        <>
          <div
            className="fixed inset-0 bg-white/70 backdrop-blur-[2px] z-40 transition-opacity"
            onClick={() => setShowUncontactedSidecart(false)}
          />
          <div className="fixed inset-0 sm:inset-y-4 sm:right-4 sm:left-auto w-full sm:max-w-3xl bg-white sm:rounded-2xl z-50 flex flex-col overflow-hidden animate-slide-in-right shadow-[0_10px_40px_-12px_rgba(17,24,39,0.18)] ring-1 ring-black/5">
            <div className="flex items-center justify-between p-6 border-b border-border-default">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-info/10 rounded-lg">
                  <PhoneIcon className="h-6 w-6 text-info" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">Leads Sin Contactar</h2>
                  <p className="text-sm text-text-secondary mt-1">
                    {uncontactedLeads.length} lead{uncontactedLeads.length > 1 ? 's' : ''} pendiente{uncontactedLeads.length > 1 ? 's' : ''} de contacto
                  </p>
                </div>
              </div>
              <button onClick={() => setShowUncontactedSidecart(false)} className="p-2 hover:bg-bg-surface rounded-lg transition-colors">
                <XMarkIcon className="h-6 w-6 text-text-secondary" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {uncontactedLeads.map((lead) => {
                  const createdAt = lead.createdAt ? new Date(lead.createdAt) : null
                  const daysSinceCreation = createdAt ? Math.floor((new Date() - createdAt) / (1000 * 60 * 60 * 24)) : null
                  const isUrgent = daysSinceCreation !== null && daysSinceCreation >= 3
                  return (
                    <div key={lead.id} className={`card border-0 shadow-none ${isUrgent ? 'bg-error/5' : 'bg-info/5'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`h-10 w-10 rounded-full ${isUrgent ? 'bg-error/20' : 'bg-info/20'} flex items-center justify-center shrink-0`}>
                            <span className={`text-sm font-semibold ${isUrgent ? 'text-error' : 'text-info'}`}>
                              {lead.firstName?.charAt(0) || 'L'}
                              {lead.lastName?.charAt(0) || ''}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-text-primary truncate">
                              {lead.firstName} {lead.lastName || ''}
                            </h3>
                            <p className="text-xs text-text-secondary truncate">{lead.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-text-muted">{lead.phone}</p>
                              {lead.phone && (
                                <a
                                  href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-success/10 transition-colors"
                                  title="Abrir WhatsApp"
                                >
                                  <WhatsAppIcon className="w-4 h-4 text-success" />
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <span className="status-badge status-nuevo">Nuevo</span>
                              {lead.source && <span className="text-xs text-text-muted capitalize">Fuente: {lead.source}</span>}
                              {createdAt && <span className="text-xs text-text-muted">{createdAt.toLocaleDateString('es-AR')}</span>}
                            </div>
                          </div>
                        </div>
                        {daysSinceCreation !== null && (
                          <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg ${isUrgent ? 'bg-error/10' : 'bg-info/10'}`}>
                            <span className={`text-2xl font-bold ${isUrgent ? 'text-error' : 'text-info'}`}>{daysSinceCreation}</span>
                            <span className={`text-xs ${isUrgent ? 'text-error' : 'text-info'}`}>día{daysSinceCreation !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {uncontactedLeads.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-text-secondary">No hay leads sin contactar</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-border-default bg-bg-surface">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-error/20" />
                    <span className="text-text-secondary">Urgente (≥3 días)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-info/20" />
                    <span className="text-text-secondary">Nuevo (&lt;3 días)</span>
                  </div>
                </div>
                <button onClick={() => setShowUncontactedSidecart(false)} className="btn-secondary">Cerrar</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Membership Type Sidecart */}
      {showMembershipTypeSidecart && selectedTypeConfig && (
        <>
          <div
            className="fixed inset-0 bg-white/70 backdrop-blur-[2px] z-40 transition-opacity"
            onClick={() => setShowMembershipTypeSidecart(false)}
          />
          <div className="fixed inset-0 sm:inset-y-4 sm:right-4 sm:left-auto w-full sm:max-w-3xl bg-white sm:rounded-2xl z-50 flex flex-col overflow-hidden animate-slide-in-right shadow-[0_10px_40px_-12px_rgba(17,24,39,0.18)] ring-1 ring-black/5">
            <div className="flex items-center justify-between p-6 border-b border-border-default">
              <div className="flex items-center gap-3">
                <div className={`p-2 ${selectedTypeConfig.bgColor} rounded-lg`}>
                  <UserCircleIcon className={`h-6 w-6 ${selectedTypeConfig.textColor}`} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">{selectedTypeConfig.label}</h2>
                  <p className="text-sm text-text-secondary mt-1">
                    {filteredUsersByType.length} usuario{filteredUsersByType.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowMembershipTypeSidecart(false)} className="p-2 hover:bg-bg-surface rounded-lg transition-colors">
                <XMarkIcon className="h-6 w-6 text-text-secondary" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {filteredUsersByType.map((user) => (
                  <div key={user.id} className="card border-0 shadow-none">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`h-10 w-10 rounded-full ${selectedTypeConfig.bgColor} flex items-center justify-center shrink-0`}>
                          <span className={`text-sm font-semibold ${selectedTypeConfig.textColor}`}>
                            {user.firstName?.charAt(0) || 'U'}
                            {user.lastName?.charAt(0) || ''}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-text-primary truncate">{user.firstName} {user.lastName}</h3>
                          <p className="text-xs text-text-secondary truncate">{user.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-text-muted">{user.phone}</p>
                            {user.phone && (
                              <a
                                href={`https://wa.me/${user.phone.replace(/\D/g, '')}`}
                                target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-success/10 transition-colors"
                                title="Abrir WhatsApp"
                              >
                                <WhatsAppIcon className="w-4 h-4 text-success" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className={`status-badge ${getMembershipStatusColor(user.membershipStatus)}`}>
                              {getMembershipStatusLabel(user.membershipStatus)}
                            </span>
                            {user.membershipEndDate && (
                              <span className="text-xs text-text-muted">Vence: {new Date(user.membershipEndDate).toLocaleDateString('es-AR')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {filteredUsersByType.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-text-secondary">No hay usuarios con este tipo de membresía</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-border-default bg-bg-surface">
              <div className="flex items-center justify-between text-sm">
                <p className="text-text-secondary">
                  {filteredUsersByType.filter((u) => u.membershipStatus === 'active').length} activos de {filteredUsersByType.length} usuarios
                </p>
                <button onClick={() => setShowMembershipTypeSidecart(false)} className="btn-secondary">Cerrar</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
