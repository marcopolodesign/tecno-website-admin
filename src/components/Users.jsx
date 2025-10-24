import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { 
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import { usersService } from '../services/usersService'

const Users = () => {
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [membershipFilter, setMembershipFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showSidePanel, setShowSidePanel] = useState(false)
  const [editFormData, setEditFormData] = useState({})
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, searchTerm, membershipFilter, statusFilter])

  const fetchUsers = async () => {
    try {
      const response = await usersService.getUsers()
      setUsers(response.data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterUsers = () => {
    let filtered = users

    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone.includes(searchTerm)
      )
    }

    if (membershipFilter !== 'all') {
      filtered = filtered.filter(user => user.membershipType === membershipFilter)
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.membershipStatus === statusFilter)
    }

    setFilteredUsers(filtered)
  }

  const handleDeleteUser = async (userId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      try {
        await usersService.deleteUser(userId)
        setUsers(users.filter(user => user.id !== userId))
      } catch (error) {
        console.error('Error deleting user:', error)
      }
    }
  }

  const handleFormChange = (field, value) => {
    const newFormData = { ...editFormData, [field]: value }
    setEditFormData(newFormData)
    
    // Check if there are changes
    const hasAnyChanges = Object.keys(newFormData).some(key => {
      return newFormData[key] !== (selectedUser[key] || '')
    })
    setHasChanges(hasAnyChanges)
  }

  const handleSaveEdit = async () => {
    try {
      await usersService.updateUser(selectedUser.documentId, editFormData)
      setUsers(users.map(u => 
        u.id === selectedUser.id 
          ? { ...u, ...editFormData }
          : u
      ))
      setSelectedUser({ ...selectedUser, ...editFormData })
      setHasChanges(false)
      toast.success('Usuario actualizado exitosamente!')
      setShowSidePanel(false)
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Error al actualizar usuario.')
    }
  }

  const handleExport = async () => {
    try {
      const response = await usersService.getUsers()
      const usersData = response.data || []
      
      const csvContent = [
        ['Nombre', 'Apellido', 'Email', 'Teléfono', 'Membresía', 'Estado', 'Inicio', 'Fin'],
        ...usersData.map(user => [
          user.firstName,
          user.lastName,
          user.email,
          user.phone,
          user.membershipType,
          user.membershipStatus,
          user.startDate,
          user.endDate
        ])
      ].map(row => row.join(',')).join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users-tecnofit-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting users:', error)
    }
  }

  const getMembershipLabel = (type) => {
    const types = {
      'mensual': 'Mensual',
      'trimestral': 'Trimestral',
      'semestral': 'Semestral',
      'anual': 'Anual'
    }
    return types[type] || type
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'activo': return 'bg-green-100 text-green-800'
      case 'inactivo': return 'bg-gray-100 text-gray-800'
      case 'suspendido': return 'bg-red-100 text-red-800'
      case 'vencido': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status) => {
    const statuses = {
      'activo': 'Activo',
      'inactivo': 'Inactivo',
      'suspendido': 'Suspendido',
      'vencido': 'Vencido'
    }
    return statuses[status] || status
  }

  const getTrainingGoalLabel = (goal) => {
    const goals = {
      'perdida-peso': 'Pérdida de peso',
      'aumento-masa-muscular': 'Aumento de masa muscular',
      'mejora-resistencia': 'Mejora de resistencia',
      'tonificacion': 'Tonificación',
      'entrenamiento-funcional': 'Entrenamiento funcional',
      'preparacion-competencias': 'Preparación para competencias',
      'rehabilitacion-fisica': 'Rehabilitación física',
      'reduccion-estres': 'Reducción del estrés'
    }
    return goals[goal] || goal
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-sky-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-gray-600">Administra tus clientes activos y sus membresías</p>
        </div>
        <button
          onClick={handleExport}
          className="btn-secondary flex items-center"
        >
          <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Buscar</label>
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="form-input pl-10"
                placeholder="Buscar por nombre, email o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="form-label">Tipo de membresía</label>
            <select
              className="form-input"
              value={membershipFilter}
              onChange={(e) => setMembershipFilter(e.target.value)}
            >
              <option value="all">Todas</option>
              <option value="mensual">Mensual</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>
          </div>
          <div>
            <label className="form-label">Estado</label>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="suspendido">Suspendido</option>
              <option value="vencido">Vencido</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Membresía
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vigencia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-green-600 font-medium">
                          {user.firstName.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                    <div className="text-sm text-gray-500">{user.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {getMembershipLabel(user.membershipType)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`status-badge ${getStatusColor(user.membershipStatus)}`}>
                      {getStatusLabel(user.membershipStatus)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{new Date(user.startDate).toLocaleDateString('es-AR')}</div>
                    <div className="text-xs">hasta {new Date(user.endDate).toLocaleDateString('es-AR')}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user)
                          setEditFormData({
                            firstName: user.firstName || '',
                            lastName: user.lastName || '',
                            phone: user.phone || '',
                            emergencyContact: user.emergencyContact || '',
                            emergencyPhone: user.emergencyPhone || '',
                            medicalNotes: user.medicalNotes || '',
                            notes: user.notes || ''
                          })
                          setHasChanges(false)
                          setShowSidePanel(true)
                        }}
                        className="text-sky-600 hover:text-sky-900"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Side Panel */}
      {showSidePanel && selectedUser && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-white/70 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setShowSidePanel(false)}
          />
          
          {/* Side Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-[#edeaea] z-50 transform transition-transform duration-300 ease-in-out flex flex-col">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  Detalles del Usuario
                </h3>
                <button
                  onClick={() => setShowSidePanel(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* User Info */}
              {!isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-lg font-medium text-gray-900">{selectedUser.email}</p>
                  </div>

                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-500">Nombre completo</label>
                    <p className="text-gray-900">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-500">Teléfono</label>
                    <p className="text-gray-600">{selectedUser.phone}</p>
                  </div>

                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-500">Objetivo de entrenamiento</label>
                    <p className="text-gray-900">
                      {getTrainingGoalLabel(selectedUser.trainingGoal)}
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-500">Membresía</label>
                    <p className="text-lg font-medium text-gray-900">
                      {getMembershipLabel(selectedUser.membershipType)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Estado: {getStatusLabel(selectedUser.membershipStatus)}
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-500">Período de membresía</label>
                    <p className="text-gray-900">
                      {new Date(selectedUser.startDate).toLocaleDateString('es-AR')}
                    </p>
                    <p className="text-gray-600 text-sm">
                      hasta {new Date(selectedUser.endDate).toLocaleDateString('es-AR')}
                    </p>
                  </div>

                  {(selectedUser.emergencyContact || selectedUser.emergencyPhone) && (
                    <div className="border-t pt-4">
                      <label className="text-sm font-medium text-gray-500">Contacto de emergencia</label>
                      <p className="text-gray-900">{selectedUser.emergencyContact || 'No especificado'}</p>
                      <p className="text-gray-600">{selectedUser.emergencyPhone || 'No especificado'}</p>
                    </div>
                  )}

                  {selectedUser.medicalNotes && (
                    <div className="border-t pt-4">
                      <label className="text-sm font-medium text-gray-500">Notas médicas</label>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedUser.medicalNotes}</p>
                    </div>
                  )}

                  {selectedUser.notes && (
                    <div className="border-t pt-4">
                      <label className="text-sm font-medium text-gray-500">Notas</label>
                      <p className="text-gray-900 whitespace-pre-wrap">{selectedUser.notes}</p>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-gray-500">Fecha de conversión</label>
                    <p className="text-gray-900">
                      {new Date(selectedUser.convertedAt).toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="form-label">Nombre</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editFormData.firstName}
                      onChange={(e) => setEditFormData({...editFormData, firstName: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Apellido</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editFormData.lastName}
                      onChange={(e) => setEditFormData({...editFormData, lastName: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Teléfono</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Contacto de Emergencia</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editFormData.emergencyContact}
                      onChange={(e) => setEditFormData({...editFormData, emergencyContact: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Teléfono de Emergencia</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={editFormData.emergencyPhone}
                      onChange={(e) => setEditFormData({...editFormData, emergencyPhone: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Notas Médicas</label>
                    <textarea
                      className="form-input"
                      rows="3"
                      value={editFormData.medicalNotes}
                      onChange={(e) => setEditFormData({...editFormData, medicalNotes: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="form-label">Notas</label>
                    <textarea
                      className="form-input"
                      rows="3"
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 space-y-3 border-t pt-6">
                {!isEditing ? (
                  <>
                    <button
                      onClick={handleEditClick}
                      className="btn-primary w-full"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setShowSidePanel(false)}
                      className="btn-secondary w-full"
                    >
                      Cerrar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="btn-primary w-full"
                    >
                      Guardar Cambios
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="btn-secondary w-full"
                    >
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <Toaster position="top-right" />
    </div>
  )
}

export default Users

