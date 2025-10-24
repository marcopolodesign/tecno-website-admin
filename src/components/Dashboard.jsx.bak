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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

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
      const [prospectsData, leadsData, usersData] = await Promise.allSettled([
        prospectsService.getProspects(),
        leadsService.getLeads(),
        usersService.getUsers()
      ])
      
      const prospects = prospectsData.status === 'fulfilled' ? (prospectsData.value.data || []) : []
      const leads = leadsData.status === 'fulfilled' ? (leadsData.value.data || []) : []
      const users = usersData.status === 'fulfilled' ? (usersData.value.data || []) : []
      
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
        newLeads: leads.filter(lead => lead.attributes?.status === 'nuevo').length,
        contactedLeads: leads.filter(lead => lead.attributes?.status === 'contactado').length,
        convertedLeads: leads.filter(lead => lead.attributes?.status === 'convertido').length,
        activeUsers: users.filter(user => user.attributes?.membershipStatus === 'activo').length,
        prospectToLeadRate,
        leadToUserRate
      }
      
      setStats(newStats)
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
