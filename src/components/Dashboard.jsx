import { useState, useEffect } from 'react'
import { 
  UserGroupIcon, 
  PhoneIcon, 
  EnvelopeIcon,
  ChartBarIcon,
  UserCircleIcon,
  FunnelIcon
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
    totalProspects: 0,
    totalLeads: 0,
    totalUsers: 0,
    newLeads: 0,
    contactedLeads: 0,
    convertedLeads: 0,
    activeUsers: 0,
    prospectToLeadRate: 0,
    leadToUserRate: 0
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
  const [recentItems, setRecentItems] = useState({
    prospects: [],
    leads: [],
    users: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Get current month dates
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

      const [prospectsData, leadsData, usersData, revenueData, expiringData] = await Promise.allSettled([
        prospectsService.getProspects(),
        leadsService.getLeads(),
        usersService.getUsers(),
        paymentsService.getRevenueStats(startOfMonth, endOfMonth),
        membershipsService.getExpiringMemberships(30)
      ])
      
      const prospects = prospectsData.status === 'fulfilled' ? (prospectsData.value.data || []) : []
      const leads = leadsData.status === 'fulfilled' ? (leadsData.value.data || []) : []
      const users = usersData.status === 'fulfilled' ? (usersData.value.data || []) : []
      const revenue = revenueData.status === 'fulfilled' ? (revenueData.value.data || {}) : {}
      const expiring = expiringData.status === 'fulfilled' ? (expiringData.value.data || []) : []
      
      const prospectToLeadRate = prospects.length > 0 
        ? Math.round((leads.length / prospects.length) * 100) 
        : 0
      
      const leadToUserRate = leads.length > 0 
        ? Math.round((users.length / leads.length) * 100) 
        : 0
      
      const newStats = {
        totalProspects: prospects.length,
        totalLeads: leads.length,
        totalUsers: users.length,
        newLeads: leads.filter(lead => lead.status === 'nuevo').length,
        contactedLeads: leads.filter(lead => lead.status === 'contactado').length,
        convertedLeads: leads.filter(lead => lead.status === 'convertido').length,
        activeUsers: users.filter(user => user.membershipStatus === 'activo').length,
        prospectToLeadRate,
        leadToUserRate
      }
      
      setStats(newStats)
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

  const funnelData = [
    { name: 'Prospects', value: stats.totalProspects, color: '#3B82F6' },
    { name: 'Leads', value: stats.totalLeads, color: '#F59E0B' },
    { name: 'Users', value: stats.totalUsers, color: '#dc2626' },
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
        <p className="text-sm text-text-secondary mt-1">Resumen del embudo de conversión</p>
      </div>

      {/* Funnel Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card border-l-2 border-info">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-info/10 rounded-lg">
              <FunnelIcon className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Prospects</p>
              <p className="text-2xl font-semibold text-text-primary">{stats.totalProspects}</p>
              <p className="text-xs text-text-tertiary mt-0.5">Email capturado</p>
            </div>
          </div>
        </div>

        <div className="card border-l-2 border-warning">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-warning/10 rounded-lg">
              <UserGroupIcon className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Leads</p>
              <p className="text-2xl font-semibold text-text-primary">{stats.totalLeads}</p>
              <p className="text-xs text-text-tertiary mt-0.5">{stats.prospectToLeadRate}% de conversión</p>
            </div>
          </div>
        </div>

        <div className="card border-l-2 border-brand">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-brand/10 rounded-lg">
              <UserCircleIcon className="h-5 w-5 text-brand" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Clientes</p>
              <p className="text-2xl font-semibold text-text-primary">{stats.totalUsers}</p>
              <p className="text-xs text-text-tertiary mt-0.5">{stats.activeUsers} activos · {stats.leadToUserRate}% conversión</p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Overview */}
      <div className="card bg-gradient-to-br from-brand/5 to-brand/10 border-brand/20">
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
        <div className="card bg-warning/5 border-warning/20">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-warning/10 rounded">
              <svg className="h-4 w-4 text-warning" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-warning">
                {expiringMemberships.length} membresía{expiringMemberships.length > 1 ? 's' : ''} por vencer
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Hay membresías que vencen en los próximos 30 días. Contacta a estos clientes para renovar.
              </p>
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
    </div>
  )
}

export default Dashboard
