import { useState, useEffect } from 'react'
import { 
  UserGroupIcon, 
  PhoneIcon, 
  EnvelopeIcon,
  ChartBarIcon,
  UserCircleIcon,
  FunnelIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { leadsService } from '../services/leadsService'
import { prospectsService } from '../services/prospectsService'
import { usersService } from '../services/usersService'
import paymentsService from '../services/paymentsService'
import membershipsService from '../services/membershipsService'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import { CurrencyDollarIcon, ArrowTrendingUpIcon, UsersIcon as UsersIconSolid } from '@heroicons/react/24/solid'

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    wellhubUsers: 0,
    sportclubUsers: 0,
    foundingMembers: 0,
    freeUsers: 0
  })
  const [revenueStats, setRevenueStats] = useState({
    totalRevenue: 0,
    newCustomersRevenue: 0,
    renewalsRevenue: 0,
    newCustomersCount: 0,
    renewalsCount: 0,
    byMembershipType: {}
  })
  const [expiringMemberships, setExpiringMemberships] = useState([])
  const [showExpiringSidecart, setShowExpiringSidecart] = useState(false)
  const [recentItems, setRecentItems] = useState({
    prospects: [],
    leads: [],
    users: []
  })
  const [loading, setLoading] = useState(true)
  const [funnelData, setFunnelData] = useState([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Get current month dates
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

      const [usersData, prospectsData, leadsData, revenueData, expiringData] = await Promise.allSettled([
        usersService.getUsers(),
        prospectsService.getProspects(),
        leadsService.getLeads(),
        paymentsService.getRevenueStats(startOfMonth, endOfMonth),
        membershipsService.getExpiringMemberships(30)
      ])

      const users = usersData.status === 'fulfilled' ? (usersData.value.data || []) : []
      const prospects = prospectsData.status === 'fulfilled' ? (prospectsData.value.data || []) : []
      const leads = leadsData.status === 'fulfilled' ? (leadsData.value.data || []) : []
      const revenue = revenueData.status === 'fulfilled' ? (revenueData.value.data || {}) : {}
      const expiring = expiringData.status === 'fulfilled' ? (expiringData.value.data || []) : []
      
      const newStats = {
        totalUsers: users.length,
        activeUsers: users.filter(user => user.membershipStatus === 'active').length,
        wellhubUsers: users.filter(user => user.membershipType === 'wellhub').length,
        sportclubUsers: users.filter(user => user.membershipType === 'sportclub').length,
        foundingMembers: users.filter(user => user.membershipType === 'socio_fundador').length,
        freeUsers: users.filter(user => user.membershipType === 'free').length
      }
      
      // Create funnel data
      const funnelStats = [
        { name: 'Prospectos', value: prospects.length, color: '#3b82f6' },
        { name: 'Leads', value: leads.length, color: '#f59e0b' },
        { name: 'Usuarios', value: users.length, color: '#10b981' }
      ]

      setStats(newStats)
      setFunnelData(funnelStats)
      setRevenueStats(revenue)
      setExpiringMemberships(expiring)
      setRecentItems({
        prospects: prospects.slice(0, 3),
        leads: leads.slice(0, 3),
        users: users.slice(0, 3)
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'nuevo': return 'status-nuevo'
      case 'contactado': return 'status-contactado'
      case 'convertido': return 'status-convertido'
      case 'perdido': return 'status-perdido'
      default: return 'bg-bg-surface text-text-secondary'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'nuevo': return 'Nuevo'
      case 'contactado': return 'Contactado'
      case 'convertido': return 'Convertido'
      case 'perdido': return 'Perdido'
      default: return status
    }
  }

  const membershipTypeData = [
    { name: 'Wellhub', value: stats.wellhubUsers, color: '#10B981' },
    { name: 'SportClub', value: stats.sportclubUsers, color: '#3B82F6' },
    { name: 'Socios Fundadores', value: stats.foundingMembers, color: '#F59E0B' },
    { name: 'Free', value: stats.freeUsers, color: '#6B7280' },
  ]

  // Custom tooltip for light theme
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">Resumen de clientes y membresías</p>
      </div>

      {/* User Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card border-l-2 border-brand">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-brand/10 rounded-lg">
              <UserGroupIcon className="h-5 w-5 text-brand" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Total Clientes</p>
              <p className="text-2xl font-semibold text-text-primary">{stats.totalUsers}</p>
              <p className="text-xs text-text-tertiary mt-0.5">{stats.activeUsers} activos</p>
            </div>
          </div>
        </div>

        <div className="card border-l-2 border-green-500">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <UserCircleIcon className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Wellhub</p>
              <p className="text-2xl font-semibold text-text-primary">{stats.wellhubUsers}</p>
              <p className="text-xs text-text-tertiary mt-0.5">Gympass</p>
            </div>
          </div>
        </div>

        <div className="card border-l-2 border-info">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-info/10 rounded-lg">
              <UserCircleIcon className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">SportClub</p>
              <p className="text-2xl font-semibold text-text-primary">{stats.sportclubUsers}</p>
              <p className="text-xs text-text-tertiary mt-0.5">Socios</p>
            </div>
          </div>
        </div>

        <div className="card border-l-2 border-warning">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-warning/10 rounded-lg">
              <UserCircleIcon className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Fundadores</p>
              <p className="text-2xl font-semibold text-text-primary">{stats.foundingMembers}</p>
              <p className="text-xs text-text-tertiary mt-0.5">Socios fundadores</p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Overview */}
      <div className="card bg-linear-to-br from-brand/5 to-brand/10 border-brand/20">
        <div className="flex items-center gap-2 mb-4">
          <CurrencyDollarIcon className="h-5 w-5 text-brand" />
          <h2 className="text-sm font-semibold text-text-primary">Ingresos del Mes</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-bg-secondary/50 rounded-lg p-4 border border-border-default">
            <p className="text-xs font-medium text-text-tertiary mb-1">Ingresos Totales</p>
            <p className="text-2xl font-semibold text-brand">
              ${revenueStats.totalRevenue?.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              {revenueStats.newCustomersCount + revenueStats.renewalsCount} pagos
            </p>
          </div>

          <div className="bg-bg-secondary/50 rounded-lg p-4 border border-border-default">
            <p className="text-xs font-medium text-text-tertiary mb-1 flex items-center gap-1">
              <UsersIconSolid className="h-3 w-3 text-info" />
              Clientes Nuevos
            </p>
            <p className="text-xl font-semibold text-info">
              ${revenueStats.newCustomersRevenue?.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
            </p>
            <p className="text-xs text-text-tertiary mt-1">{revenueStats.newCustomersCount} clientes</p>
          </div>

          <div className="bg-bg-secondary/50 rounded-lg p-4 border border-border-default">
            <p className="text-xs font-medium text-text-tertiary mb-1 flex items-center gap-1">
              <ArrowTrendingUpIcon className="h-3 w-3 text-purple-500" />
              Renovaciones
            </p>
            <p className="text-xl font-semibold text-purple-400">
              ${revenueStats.renewalsRevenue?.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
            </p>
            <p className="text-xs text-text-tertiary mt-1">{revenueStats.renewalsCount} renovaciones</p>
          </div>
        </div>

        {/* Revenue by Membership Type */}
        {Object.keys(revenueStats.byMembershipType || {}).length > 0 && (
          <div className="mt-4 bg-bg-secondary/50 rounded-lg p-4 border border-border-default">
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

      {/* Expiring Memberships Alert */}
      {expiringMemberships.length > 0 && (
        <div 
          className="card bg-warning/5 border-warning/20 cursor-pointer hover:bg-warning/10 transition-colors"
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
                Hay membresías que vencen en los próximos 30 días. Haz clic para ver detalles.
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

      {/* Leads Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-info/10 rounded-lg flex items-center justify-center">
              <span className="text-info font-semibold text-sm">N</span>
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary">Leads Nuevos</p>
              <p className="text-lg font-semibold text-text-primary">{stats.newLeads}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-warning/10 rounded-lg flex items-center justify-center">
              <PhoneIcon className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary">Contactados</p>
              <p className="text-lg font-semibold text-text-primary">{stats.contactedLeads}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-brand/10 rounded-lg flex items-center justify-center">
              <ChartBarIcon className="h-4 w-4 text-brand" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary">Convertidos</p>
              <p className="text-lg font-semibold text-text-primary">{stats.convertedLeads}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <EnvelopeIcon className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary">Tasa General</p>
              <p className="text-lg font-semibold text-text-primary">
                {stats.totalProspects > 0 ? Math.round((stats.totalUsers / stats.totalProspects) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Embudo de Conversión</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={{ stroke: '#e5e7eb' }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={{ stroke: '#e5e7eb' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Actividad Reciente</h3>
          <div className="space-y-2">
            {recentItems.leads.length === 0 && recentItems.prospects.length === 0 && recentItems.users.length === 0 ? (
              <p className="text-sm text-text-tertiary text-center py-8">
                No hay datos disponibles.
              </p>
            ) : (
              <>
                {recentItems.leads.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 bg-bg-surface rounded-lg border border-border-default hover:border-border-hover transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-warning/10 rounded-full flex items-center justify-center">
                        <span className="text-warning font-medium text-sm">
                          {lead.attributes?.firstName?.charAt(0) || 'L'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {lead.attributes?.firstName || 'N/A'} {lead.attributes?.lastName || ''}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          Lead · {lead.attributes?.status || 'nuevo'}
                        </p>
                      </div>
                    </div>
                    <span className={`status-badge ${getStatusColor(lead.attributes?.status)}`}>
                      {getStatusLabel(lead.attributes?.status)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expiring Memberships Sidecart */}
      {showExpiringSidecart && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => setShowExpiringSidecart(false)}
          />
          
          {/* Sidecart Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-bg-primary shadow-xl z-50 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border-default">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">Membresías por Vencer</h2>
                <p className="text-sm text-text-secondary mt-1">
                  {expiringMemberships.length} membresía{expiringMemberships.length > 1 ? 's' : ''} vencen en los próximos 30 días
                </p>
              </div>
              <button
                onClick={() => setShowExpiringSidecart(false)}
                className="p-2 hover:bg-bg-surface rounded-lg transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-text-secondary" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {expiringMemberships.map((membership) => {
                  const daysUntilExpiry = Math.ceil(
                    (new Date(membership.endDate) - new Date()) / (1000 * 60 * 60 * 24)
                  )
                  const isUrgent = daysUntilExpiry <= 7
                  
                  return (
                    <div 
                      key={membership.id} 
                      className={`card ${isUrgent ? 'border-error/30 bg-error/5' : 'border-warning/30 bg-warning/5'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          {/* Avatar */}
                          <div className={`h-10 w-10 rounded-full ${isUrgent ? 'bg-error/20' : 'bg-warning/20'} flex items-center justify-center shrink-0`}>
                            <span className={`text-sm font-semibold ${isUrgent ? 'text-error' : 'text-warning'}`}>
                              {membership.users?.firstName?.charAt(0) || 'U'}
                              {membership.users?.lastName?.charAt(0) || ''}
                            </span>
                          </div>

                          {/* User Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-text-primary truncate">
                              {membership.users?.firstName} {membership.users?.lastName}
                            </h3>
                            <p className="text-xs text-text-secondary truncate">
                              {membership.users?.email}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-text-muted">
                                {membership.users?.phone}
                              </p>
                              {membership.users?.phone && (
                                <a
                                  href={`https://wa.me/${membership.users.phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-success/10 transition-colors group"
                                  title="Abrir WhatsApp"
                                >
                                  <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                  </svg>
                                </a>
                              )}
                            </div>
                            
                            {/* Membership Details */}
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

                        {/* Days Badge */}
                        <div className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg ${isUrgent ? 'bg-error/10' : 'bg-warning/10'}`}>
                          <span className={`text-2xl font-bold ${isUrgent ? 'text-error' : 'text-warning'}`}>
                            {daysUntilExpiry}
                          </span>
                          <span className={`text-xs ${isUrgent ? 'text-error' : 'text-warning'}`}>
                            día{daysUntilExpiry !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {expiringMemberships.length === 0 && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-4">
                    <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-text-secondary">No hay membresías por vencer</p>
                </div>
              )}
            </div>

            {/* Footer */}
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
                <button
                  onClick={() => setShowExpiringSidecart(false)}
                  className="btn-secondary"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
