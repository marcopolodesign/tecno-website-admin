import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { 
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import { DataGrid } from '@mui/x-data-grid'
import { usersService } from '../services/usersService'
import membershipsService from '../services/membershipsService'

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
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [reasonData, setReasonData] = useState({
    userId: null,
    newStatus: '',
    reason: ''
  })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createFormData, setCreateFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    trainingGoal: '',
    membershipType: 'mensual',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    emergencyContact: '',
    emergencyPhone: '',
    medicalNotes: '',
    notes: '',
    createPayment: true,
    paymentMethod: 'efectivo',
    paymentAmount: '',
    paymentNotes: ''
  })
  const [showRenewalModal, setShowRenewalModal] = useState(false)
  const [renewalFormData, setRenewalFormData] = useState({
    membershipType: 'mensual',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    paymentMethod: 'efectivo',
    paymentAmount: '',
    paymentNotes: ''
  })

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
        toast.success('Usuario eliminado exitosamente')
      } catch (error) {
        console.error('Error deleting user:', error)
        toast.error('Error al eliminar usuario')
      }
    }
  }

  const handleCreateUser = async () => {
    // Validate required fields
    if (!createFormData.firstName || !createFormData.email || !createFormData.phone || 
        !createFormData.trainingGoal || !createFormData.membershipType || 
        !createFormData.startDate || !createFormData.endDate) {
      toast.error('Por favor completa todos los campos requeridos')
      return
    }

    try {
      const paymentData = createFormData.createPayment ? {
        createPayment: true,
        amount: createFormData.paymentAmount,
        paymentMethod: createFormData.paymentMethod,
        paymentDate: new Date().toISOString(),
        notes: createFormData.paymentNotes
      } : null

      const response = await usersService.createUser(createFormData, paymentData)
      setUsers([response.data, ...users])
      setShowCreateModal(false)
      // Reset form
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setCreateFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        trainingGoal: '',
        membershipType: 'mensual',
        startDate: tomorrow.toISOString().split('T')[0],
        endDate: '',
        emergencyContact: '',
        emergencyPhone: '',
        medicalNotes: '',
        notes: '',
        createPayment: true,
        paymentMethod: 'efectivo',
        paymentAmount: '',
        paymentNotes: ''
      })
      toast.success('Usuario creado exitosamente')
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error('Error al crear usuario')
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

  const handleStatusChange = async (userId, newStatus) => {
    // If changing to "no-renueva", ask for reason
    if (newStatus === 'no-renueva') {
      setReasonData({
        userId,
        newStatus,
        reason: ''
      })
      setShowReasonModal(true)
      return
    }

    // For other statuses, update directly
    try {
      await usersService.updateUser(userId, { membershipStatus: newStatus })
      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, membershipStatus: newStatus }
          : user
      ))
      toast.success('Estado actualizado')
    } catch (error) {
      console.error('Error updating user status:', error)
      toast.error('Error al actualizar estado')
    }
  }

  const handleConfirmStatusWithReason = async () => {
    if (!reasonData.reason.trim()) {
      toast.error('Por favor ingresa una razón')
      return
    }

    try {
      await usersService.updateUser(reasonData.userId, { 
        membershipStatus: reasonData.newStatus,
        nonRenewalReason: reasonData.reason
      })
      setUsers(users.map(user => 
        user.id === reasonData.userId 
          ? { ...user, membershipStatus: reasonData.newStatus, nonRenewalReason: reasonData.reason }
          : user
      ))
      setShowReasonModal(false)
      setReasonData({ userId: null, newStatus: '', reason: '' })
      toast.success('Estado actualizado')
    } catch (error) {
      console.error('Error updating user status:', error)
      toast.error('Error al actualizar estado')
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
      'vencido': 'Vencido',
      'no-renueva': 'No Renueva'
    }
    return statuses[status] || status
  }

  const handleRenewMembership = async () => {
    // Validate required fields
    if (!renewalFormData.membershipType || !renewalFormData.startDate || !renewalFormData.endDate) {
      toast.error('Por favor completa todos los campos requeridos')
      return
    }

    try {
      const paymentData = {
        amount: renewalFormData.paymentAmount,
        paymentMethod: renewalFormData.paymentMethod,
        paymentDate: new Date().toISOString(),
        notes: renewalFormData.paymentNotes || 'Renovación de membresía'
      }

      await membershipsService.renewMembership(
        selectedUser.id,
        selectedUser.currentMembershipId,
        renewalFormData,
        paymentData
      )

      setShowRenewalModal(false)
      setRenewalFormData({
        membershipType: 'mensual',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        paymentMethod: 'efectivo',
        paymentAmount: '',
        paymentNotes: ''
      })
      fetchUsers()
      toast.success('Membresía renovada exitosamente')
    } catch (error) {
      console.error('Error renewing membership:', error)
      toast.error('Error al renovar membresía')
    }
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
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Crear Usuario
          </button>
          <button
            onClick={handleExport}
            className="btn-secondary flex items-center"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
            Exportar CSV
          </button>
        </div>
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
      <div className="card" style={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredUsers}
          columns={[
            {
              field: 'fullName',
              headerName: 'Usuario',
              width: 200,
              valueGetter: (value, row) => `${row.firstName || ''} ${row.lastName || ''}`,
              renderCell: (params) => (
                <div className="flex items-center">
                  <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-green-600 font-medium text-sm">
                      {params.row.firstName?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <span>{params.value}</span>
                </div>
              )
            },
            {
              field: 'email',
              headerName: 'Email',
              width: 220,
              editable: false
            },
            {
              field: 'phone',
              headerName: 'Teléfono',
              width: 150,
              editable: true
            },
            {
              field: 'membershipType',
              headerName: 'Membresía',
              width: 150,
              valueGetter: (value) => getMembershipLabel(value)
            },
            {
              field: 'membershipStatus',
              headerName: 'Estado',
              width: 150,
              editable: true,
              type: 'singleSelect',
              valueOptions: ['activo', 'inactivo', 'suspendido', 'vencido', 'no-renueva'],
              renderCell: (params) => (
                <span className={`status-badge ${getStatusColor(params.value)}`}>
                  {getStatusLabel(params.value)}
                </span>
              )
            },
            {
              field: 'startDate',
              headerName: 'Inicio',
              width: 120,
              valueFormatter: (value) => new Date(value).toLocaleDateString('es-AR')
            },
            {
              field: 'endDate',
              headerName: 'Fin',
              width: 120,
              valueFormatter: (value) => new Date(value).toLocaleDateString('es-AR')
            },
            {
              field: 'actions',
              headerName: 'Acciones',
              width: 100,
              sortable: false,
              renderCell: (params) => (
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteUser(params.row.id)
                    }}
                    className="text-red-600 hover:text-red-900"
                    title="Eliminar"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )
            }
          ]}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 10 },
            },
          }}
          pageSizeOptions={[10, 25, 50]}
          onRowClick={(params) => {
            setSelectedUser(params.row)
            setEditFormData({
              firstName: params.row.firstName || '',
              lastName: params.row.lastName || '',
              phone: params.row.phone || '',
              emergencyContact: params.row.emergencyContact || '',
              emergencyPhone: params.row.emergencyPhone || '',
              medicalNotes: params.row.medicalNotes || '',
              notes: params.row.notes || ''
            })
            setHasChanges(false)
            setShowSidePanel(true)
          }}
          processRowUpdate={async (newRow, oldRow) => {
            // Handle status change with reason if needed
            if (newRow.membershipStatus !== oldRow.membershipStatus && newRow.membershipStatus === 'no-renueva') {
              setReasonData({
                userId: newRow.id,
                newStatus: 'no-renueva',
                reason: ''
              })
              setShowReasonModal(true)
              return oldRow // Return old row, will update after reason is provided
            }
            
            // Handle other edits
            try {
              await usersService.updateUser(newRow.documentId, {
                firstName: newRow.firstName,
                lastName: newRow.lastName,
                phone: newRow.phone,
                membershipStatus: newRow.membershipStatus
              })
              setUsers(users.map(u => u.id === newRow.id ? newRow : u))
              toast.success('Usuario actualizado')
              return newRow
            } catch (error) {
              console.error('Error updating user:', error)
              toast.error('Error al actualizar usuario')
              return oldRow
            }
          }}
          onProcessRowUpdateError={(error) => {
            console.error('Error processing row update:', error)
            toast.error('Error al actualizar')
          }}
          sx={{
            '& .MuiDataGrid-row': {
              cursor: 'pointer'
            }
          }}
        />
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

              {/* User Info - Editable Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-lg font-medium text-gray-900">{selectedUser.email}</p>
                </div>

                <div className="border-t border-[#edeaea] pt-4">
                  <label className="form-label">Nombre</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.firstName}
                    onChange={(e) => handleFormChange('firstName', e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Apellido</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.lastName}
                    onChange={(e) => handleFormChange('lastName', e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Teléfono</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={editFormData.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                  />
                </div>

                <div className="border-t border-[#edeaea] pt-4">
                  <label className="text-sm font-medium text-gray-500">Objetivo de entrenamiento</label>
                  <p className="text-gray-900">
                    {getTrainingGoalLabel(selectedUser.trainingGoal)}
                  </p>
                </div>

                <div className="border-t border-[#edeaea] pt-4">
                  <label className="text-sm font-medium text-gray-500">Membresía</label>
                  <p className="text-lg font-medium text-gray-900">
                    {getMembershipLabel(selectedUser.membershipType)}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Estado: {getStatusLabel(selectedUser.membershipStatus)}
                  </p>
                </div>

                <div className="border-t border-[#edeaea] pt-4">
                  <label className="text-sm font-medium text-gray-500">Período de membresía</label>
                  <p className="text-gray-900">
                    {new Date(selectedUser.startDate).toLocaleDateString('es-AR')}
                  </p>
                  <p className="text-gray-600 text-sm">
                    hasta {new Date(selectedUser.endDate).toLocaleDateString('es-AR')}
                  </p>
                </div>

                <div className="border-t border-[#edeaea] pt-4">
                  <label className="form-label">Contacto de Emergencia</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.emergencyContact}
                    onChange={(e) => handleFormChange('emergencyContact', e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Teléfono de Emergencia</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={editFormData.emergencyPhone}
                    onChange={(e) => handleFormChange('emergencyPhone', e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Notas Médicas</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={editFormData.medicalNotes}
                    onChange={(e) => handleFormChange('medicalNotes', e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Notas</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={editFormData.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                  />
                </div>

                <div className="border-t border-[#edeaea] pt-4">
                  <label className="text-sm font-medium text-gray-500">Fecha de conversión</label>
                  <p className="text-gray-900">
                    {new Date(selectedUser.convertedAt).toLocaleString('es-AR')}
                  </p>
                </div>

                {/* UTM Parameters */}
                {(selectedUser.utmSource || selectedUser.utmMedium || selectedUser.utmCampaign || selectedUser.utmTerm || selectedUser.utmContent) && (
                  <div className="border-t border-[#edeaea] pt-4">
                    <label className="text-sm font-medium text-gray-500 mb-2 block">Parámetros UTM</label>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                      {selectedUser.utmSource && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Source:</span>
                          <span className="font-medium text-gray-900">{selectedUser.utmSource}</span>
                        </div>
                      )}
                      {selectedUser.utmMedium && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Medium:</span>
                          <span className="font-medium text-gray-900">{selectedUser.utmMedium}</span>
                        </div>
                      )}
                      {selectedUser.utmCampaign && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Campaign:</span>
                          <span className="font-medium text-gray-900">{selectedUser.utmCampaign}</span>
                        </div>
                      )}
                      {selectedUser.utmTerm && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Term:</span>
                          <span className="font-medium text-gray-900">{selectedUser.utmTerm}</span>
                        </div>
                      )}
                      {selectedUser.utmContent && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Content:</span>
                          <span className="font-medium text-gray-900">{selectedUser.utmContent}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 space-y-3 border-t pt-6">
                {hasChanges && (
                  <button
                    onClick={handleSaveEdit}
                    className="btn-primary w-full"
                  >
                    Confirmar edición
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowRenewalModal(true)
                    setShowSidePanel(false)
                  }}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Renovar Membresía
                </button>
                <button
                  onClick={() => setShowSidePanel(false)}
                  className="btn-secondary w-full"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reason Modal */}
      {showReasonModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-[70]"
            onClick={() => setShowReasonModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-[70] p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              ¿Por qué no renueva?
            </h3>
            <textarea
              className="form-input w-full"
              rows="4"
              placeholder="Ingresa la razón..."
              value={reasonData.reason}
              onChange={(e) => setReasonData({...reasonData, reason: e.target.value})}
            />
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowReasonModal(false)
                  setReasonData({ userId: null, newStatus: '', reason: '' })
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmStatusWithReason}
                className="btn-primary"
              >
                Confirmar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-[70]"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-[70] p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              Crear Nuevo Usuario
            </h3>
            
            <div className="space-y-4">
              {/* Personal Info */}
              <div className="border-b border-gray-200 pb-4">
                <h4 className="font-semibold text-gray-900 mb-3">Información Personal</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Nombre *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={createFormData.firstName}
                      onChange={(e) => setCreateFormData({...createFormData, firstName: e.target.value})}
                      placeholder="Juan"
                    />
                  </div>
                  <div>
                    <label className="form-label">Apellido</label>
                    <input
                      type="text"
                      className="form-input"
                      value={createFormData.lastName}
                      onChange={(e) => setCreateFormData({...createFormData, lastName: e.target.value})}
                      placeholder="Pérez"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className="form-input"
                      value={createFormData.email}
                      onChange={(e) => setCreateFormData({...createFormData, email: e.target.value})}
                      placeholder="juan@example.com"
                    />
                  </div>
                  <div>
                    <label className="form-label">Teléfono *</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={createFormData.phone}
                      onChange={(e) => setCreateFormData({...createFormData, phone: e.target.value})}
                      placeholder="+54 9 11 1234-5678"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="form-label">Objetivo de entrenamiento *</label>
                  <select
                    className="form-input"
                    value={createFormData.trainingGoal}
                    onChange={(e) => setCreateFormData({...createFormData, trainingGoal: e.target.value})}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="perdida-peso">Pérdida de peso</option>
                    <option value="aumento-masa-muscular">Aumento de masa muscular</option>
                    <option value="mejora-resistencia">Mejora de resistencia</option>
                    <option value="tonificacion">Tonificación</option>
                    <option value="entrenamiento-funcional">Entrenamiento funcional</option>
                    <option value="preparacion-competencias">Preparación para competencias</option>
                    <option value="rehabilitacion-fisica">Rehabilitación física</option>
                    <option value="reduccion-estres">Reducción del estrés</option>
                  </select>
                </div>
              </div>

              {/* Membership Info */}
              <div className="border-b border-gray-200 pb-4">
                <h4 className="font-semibold text-gray-900 mb-3">Información de Membresía</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">Tipo de Membresía *</label>
                    <select
                      className="form-input"
                      value={createFormData.membershipType}
                      onChange={(e) => setCreateFormData({...createFormData, membershipType: e.target.value})}
                    >
                      <option value="mensual">Mensual</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="semestral">Semestral</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Fecha de Inicio *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={createFormData.startDate}
                      onChange={(e) => setCreateFormData({...createFormData, startDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="form-label">Fecha de Fin *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={createFormData.endDate}
                      onChange={(e) => setCreateFormData({...createFormData, endDate: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="border-b border-gray-200 pb-4">
                <h4 className="font-semibold text-gray-900 mb-3">Contacto de Emergencia</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Nombre del Contacto</label>
                    <input
                      type="text"
                      className="form-input"
                      value={createFormData.emergencyContact}
                      onChange={(e) => setCreateFormData({...createFormData, emergencyContact: e.target.value})}
                      placeholder="María Pérez"
                    />
                  </div>
                  <div>
                    <label className="form-label">Teléfono de Emergencia</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={createFormData.emergencyPhone}
                      onChange={(e) => setCreateFormData({...createFormData, emergencyPhone: e.target.value})}
                      placeholder="+54 9 11 9876-5432"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Notas</h4>
                <div>
                  <label className="form-label">Notas Médicas</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    value={createFormData.medicalNotes}
                    onChange={(e) => setCreateFormData({...createFormData, medicalNotes: e.target.value})}
                    placeholder="Condiciones médicas, lesiones, etc..."
                  />
                </div>
                <div className="mt-4">
                  <label className="form-label">Notas Generales</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    value={createFormData.notes}
                    onChange={(e) => setCreateFormData({...createFormData, notes: e.target.value})}
                    placeholder="Información adicional..."
                  />
                </div>
              </div>

              {/* Payment Info */}
              <div className="border-b border-gray-200 pb-4">
                <h4 className="font-semibold text-gray-900 mb-3">Información de Pago</h4>
                <div className="mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={createFormData.createPayment}
                      onChange={(e) => setCreateFormData({...createFormData, createPayment: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Registrar pago</span>
                  </label>
                </div>

                {createFormData.createPayment && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="form-label">Método de Pago *</label>
                        <select
                          className="form-input"
                          value={createFormData.paymentMethod}
                          onChange={(e) => setCreateFormData({...createFormData, paymentMethod: e.target.value})}
                        >
                          <option value="efectivo">Efectivo</option>
                          <option value="tarjeta">Tarjeta</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="mercadopago">Mercado Pago</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Monto (opcional)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={createFormData.paymentAmount}
                          onChange={(e) => setCreateFormData({...createFormData, paymentAmount: e.target.value})}
                          placeholder="Dejar vacío para usar precio de plan"
                          step="0.01"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Notas de Pago</label>
                      <textarea
                        className="form-input"
                        rows="2"
                        value={createFormData.paymentNotes}
                        onChange={(e) => setCreateFormData({...createFormData, paymentNotes: e.target.value})}
                        placeholder="Información adicional sobre el pago..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  const tomorrow = new Date()
                  tomorrow.setDate(tomorrow.getDate() + 1)
                  setCreateFormData({
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    trainingGoal: '',
                    membershipType: 'mensual',
                    startDate: tomorrow.toISOString().split('T')[0],
                    endDate: '',
                    emergencyContact: '',
                    emergencyPhone: '',
                    medicalNotes: '',
                    notes: '',
                    createPayment: true,
                    paymentMethod: 'efectivo',
                    paymentAmount: '',
                    paymentNotes: ''
                  })
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateUser}
                className="btn-primary"
              >
                Crear Usuario
              </button>
            </div>
          </div>
        </>
      )}

      {/* Renewal Modal */}
      {showRenewalModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-[70]"
            onClick={() => setShowRenewalModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-[70] p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              Renovar Membresía
            </h3>
            
            <div className="space-y-4">
              {/* Membership Info */}
              <div className="border-b border-gray-200 pb-4">
                <h4 className="font-semibold text-gray-900 mb-3">Nueva Membresía</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">Tipo de Membresía *</label>
                    <select
                      className="form-input"
                      value={renewalFormData.membershipType}
                      onChange={(e) => setRenewalFormData({...renewalFormData, membershipType: e.target.value})}
                    >
                      <option value="mensual">Mensual</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="semestral">Semestral</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Fecha de Inicio *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={renewalFormData.startDate}
                      onChange={(e) => setRenewalFormData({...renewalFormData, startDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="form-label">Fecha de Fin *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={renewalFormData.endDate}
                      onChange={(e) => setRenewalFormData({...renewalFormData, endDate: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="border-b border-gray-200 pb-4">
                <h4 className="font-semibold text-gray-900 mb-3">Información de Pago</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Método de Pago *</label>
                      <select
                        className="form-input"
                        value={renewalFormData.paymentMethod}
                        onChange={(e) => setRenewalFormData({...renewalFormData, paymentMethod: e.target.value})}
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="mercadopago">Mercado Pago</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Monto (opcional)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={renewalFormData.paymentAmount}
                        onChange={(e) => setRenewalFormData({...renewalFormData, paymentAmount: e.target.value})}
                        placeholder="Dejar vacío para usar precio de plan"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Notas de Pago</label>
                    <textarea
                      className="form-input"
                      rows="2"
                      value={renewalFormData.paymentNotes}
                      onChange={(e) => setRenewalFormData({...renewalFormData, paymentNotes: e.target.value})}
                      placeholder="Información adicional sobre el pago..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRenewalModal(false)
                  setRenewalFormData({
                    membershipType: 'mensual',
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: '',
                    paymentMethod: 'efectivo',
                    paymentAmount: '',
                    paymentNotes: ''
                  })
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleRenewMembership}
                className="btn-primary"
              >
                Renovar Membresía
              </button>
            </div>
          </div>
        </>
      )}

      <Toaster position="top-right" />
    </div>
  )
}

export default Users

