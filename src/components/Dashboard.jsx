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
      case 'nuevo': return 'bg-blue-100 text-blue-800'
      case 'contactado': return 'bg-yellow-100 text-yellow-800'
      case 'convertido': return 'bg-green-100 text-green-800'
      case 'perdido': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
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
    { name: 'Prospects', value: stats.totalProspects, color: '#3b82f6' },
    { name: 'Leads', value: stats.totalLeads, color: '#f59e0b' },
    { name: 'Users', value: stats.totalUsers, color: '#10b981' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-sky-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard - Embudo de Conversión</h1>
        <p className="text-gray-600">Resumen completo del funnel de ventas</p>
      </div>

      {/* Funnel Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card border-l-4 border-blue-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FunnelIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Prospects
                </dt>
                <dd className="text-2xl font-bold text-gray-900">
                  {stats.totalProspects}
                </dd>
                <dd className="text-xs text-gray-500 mt-1">
                  Email capturado
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-amber-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserGroupIcon className="h-8 w-8 text-amber-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Leads
                </dt>
                <dd className="text-2xl font-bold text-gray-900">
                  {stats.totalLeads}
                </dd>
                <dd className="text-xs text-gray-500 mt-1">
                  {stats.prospectToLeadRate}% de conversión
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserCircleIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Clientes
                </dt>
                <dd className="text-2xl font-bold text-gray-900">
                  {stats.totalUsers}
                </dd>
                <dd className="text-xs text-gray-500 mt-1">
                  {stats.activeUsers} activos · {stats.leadToUserRate}% conversión
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Overview */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <CurrencyDollarIcon className="h-6 w-6 text-green-600 mr-2" />
          Ingresos del Mes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <dt className="text-sm font-medium text-gray-500 mb-1">
              Ingresos Totales
            </dt>
            <dd className="text-3xl font-bold text-green-600">
              ${revenueStats.totalRevenue?.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
            </dd>
            <dd className="text-xs text-gray-500 mt-1">
              {revenueStats.newCustomersCount + revenueStats.renewalsCount} pagos
            </dd>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center">
              <UsersIconSolid className="h-4 w-4 text-blue-500 mr-1" />
              Clientes Nuevos
            </dt>
            <dd className="text-2xl font-bold text-blue-600">
              ${revenueStats.newCustomersRevenue?.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
            </dd>
            <dd className="text-xs text-gray-500 mt-1">
              {revenueStats.newCustomersCount} clientes
            </dd>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center">
              <ArrowTrendingUpIcon className="h-4 w-4 text-purple-500 mr-1" />
              Renovaciones
            </dt>
            <dd className="text-2xl font-bold text-purple-600">
              ${revenueStats.renewalsRevenue?.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
            </dd>
            <dd className="text-xs text-gray-500 mt-1">
              {revenueStats.renewalsCount} renovaciones
            </dd>
          </div>
        </div>

        {/* Revenue by Membership Type */}
        {Object.keys(revenueStats.byMembershipType || {}).length > 0 && (
          <div className="mt-6 bg-white rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Ingresos por Tipo de Membresía</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(revenueStats.byMembershipType).map(([type, data]) => (
                <div key={type} className="text-center">
                  <div className="text-xs text-gray-500 capitalize mb-1">{type}</div>
                  <div className="text-lg font-bold text-gray-900">
                    ${data.revenue?.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
                  </div>
                  <div className="text-xs text-gray-400">{data.count} pagos</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Expiring Memberships Alert */}
      {expiringMemberships.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                {expiringMemberships.length} membresía{expiringMemberships.length > 1 ? 's' : ''} por vencer
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Hay membresías que vencen en los próximos 30 días. Contacta a estos clientes para renovar.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leads Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-bold">N</span>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Leads Nuevos
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {stats.newLeads}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <PhoneIcon className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Contactados
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {stats.contactedLeads}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Convertidos
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {stats.convertedLeads}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <EnvelopeIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Tasa General
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {stats.totalProspects > 0 ? Math.round((stats.totalUsers / stats.totalProspects) * 100) : 0}%
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Chart */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Embudo de Conversión
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value">
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
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Actividad Reciente
          </h3>
          <div className="space-y-3">
            {recentItems.leads.length === 0 && recentItems.prospects.length === 0 && recentItems.users.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No hay datos disponibles. Configura los permisos en Strapi.
              </p>
            ) : (
              <>
                {recentItems.leads.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 bg-amber-100 rounded-full flex items-center justify-center">
                          <span className="text-amber-600 font-medium text-sm">
                            {lead.attributes?.firstName?.charAt(0) || 'L'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {lead.attributes?.firstName || 'N/A'} {lead.attributes?.lastName || ''}
                        </p>
                        <p className="text-xs text-gray-500">
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
