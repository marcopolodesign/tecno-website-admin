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
import { sellersService } from '../services/sellersService'
import membershipPlansService from '../services/membershipPlansService'
import { dataGridStyles, toastOptions } from '../lib/themeStyles'
import membershipsService from '../services/membershipsService'
import logsService from '../services/logsService'
import { getCurrentUserForLogging } from '../utils/logHelpers'
import LogsTimeline from './LogsTimeline'

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
  const [sellers, setSellers] = useState([])
  const [membershipPlans, setMembershipPlans] = useState([])
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [reasonData, setReasonData] = useState({
    userId: null,
    newStatus: '',
    reason: ''
  })
  const [showCreateModal, setShowCreateModal] = useState(false)
  // Calculate default end date (1 month from today)
  const getDefaultEndDate = () => {
    const today = new Date()
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + 1)
    return endDate.toISOString().split('T')[0]
  }

  const [createFormData, setCreateFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    trainingGoal: '',
    membershipType: 'Socio_Basic',
    startDate: new Date().toISOString().split('T')[0],
    endDate: getDefaultEndDate(),
    emergencyContact: '',
    emergencyPhone: '',
    medicalNotes: '',
    notes: '',
    createPayment: true,
    paymentMethod: 'efectivo',
    paymentAmount: 60000,
    paymentNotes: ''
  })
  const [showRenewalModal, setShowRenewalModal] = useState(false)
  const [renewalFormData, setRenewalFormData] = useState({
    membershipType: 'Socio',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    paymentMethod: 'efectivo',
    paymentAmount: 55000,
    paymentNotes: ''
  })
  const [showChangeMembershipModal, setShowChangeMembershipModal] = useState(false)
  const [changeMembershipFormData, setChangeMembershipFormData] = useState({
    membershipType: '',
    startDate: '',
    endDate: '',
    status: 'active'
  })

  useEffect(() => {
    fetchUsers()
    fetchSellers()
    fetchMembershipPlans()
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

  const fetchSellers = async () => {
    try {
      const response = await sellersService.getSellers()
      setSellers(response.data || [])
    } catch (error) {
      console.error('Error fetching sellers:', error)
    }
  }

  const getSellerName = (sellerId) => {
    if (!sellerId) return 'Sin asignar'
    const seller = sellers.find(s => s.id === sellerId)
    return seller ? `${seller.first_name} ${seller.last_name}` : 'Sin asignar'
  }

  const fetchMembershipPlans = async () => {
    try {
      const response = await membershipPlansService.getPlans()
      setMembershipPlans(response.data || [])
    } catch (error) {
      console.error('Error fetching membership plans:', error)
    }
  }

  // Get price based on selected plan and payment method
  const getCalculatedPrice = (planName, paymentMethod) => {
    const plan = membershipPlans.find(p => p.name === planName)
    if (!plan) return ''
    return membershipPlansService.getPriceForPaymentMethod(plan, paymentMethod)
  }

  // Handle create form change with auto-price
  const handleCreateFormChange = (field, value) => {
    const newFormData = { ...createFormData, [field]: value }
    
    // Auto-calculate price when membership type or payment method changes
    if (field === 'membershipType' || field === 'paymentMethod') {
      const planName = field === 'membershipType' ? value : createFormData.membershipType
      const method = field === 'paymentMethod' ? value : createFormData.paymentMethod
      const calculatedPrice = getCalculatedPrice(planName, method)
      newFormData.paymentAmount = calculatedPrice
    }
    
    setCreateFormData(newFormData)
  }

  // Handle renewal form change with auto-price
  const handleRenewalFormChange = (field, value) => {
    const newFormData = { ...renewalFormData, [field]: value }
    
    // Auto-calculate price when membership type or payment method changes
    if (field === 'membershipType' || field === 'paymentMethod') {
      const planName = field === 'membershipType' ? value : renewalFormData.membershipType
      const method = field === 'paymentMethod' ? value : renewalFormData.paymentMethod
      const calculatedPrice = getCalculatedPrice(planName, method)
      newFormData.paymentAmount = calculatedPrice
    }
    
    setRenewalFormData(newFormData)
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
      const today = new Date()
      const endDate = new Date(today)
      endDate.setMonth(endDate.getMonth() + 1)
      setCreateFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        trainingGoal: '',
        membershipType: 'Socio_Basic',
        startDate: today.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        emergencyContact: '',
        emergencyPhone: '',
        medicalNotes: '',
        notes: '',
        createPayment: true,
        paymentMethod: 'efectivo',
        paymentAmount: 60000,
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
      await usersService.updateUser(selectedUser.id, editFormData)
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
      // English values from database
      case 'active': return 'status-convertido'
      case 'expired': return 'status-contactado'
      case 'cancelled': return 'status-perdido'
      // Legacy Spanish values
      case 'activo': return 'status-convertido'
      case 'inactivo': return 'bg-bg-surface text-text-secondary border border-border-default'
      case 'suspendido': return 'status-perdido'
      case 'vencido': return 'status-contactado'
      default: return 'bg-bg-surface text-text-secondary border border-border-default'
    }
  }

  const getStatusLabel = (status) => {
    const statuses = {
      // English values from database
      'active': 'Activo',
      'expired': 'Vencido',
      'cancelled': 'Cancelado',
      // Legacy Spanish values (just in case)
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

      // Log the membership renewal
      try {
        const performedBy = await getCurrentUserForLogging()
        await logsService.logMembershipRenewed(
          selectedUser.currentMembershipId,
          null, // New membership ID will be set by the service
          selectedUser.id,
          `${selectedUser.firstName} ${selectedUser.lastName}`,
          {
            type: renewalFormData.membershipType,
            startDate: renewalFormData.startDate,
            endDate: renewalFormData.endDate,
            paymentMethod: renewalFormData.paymentMethod,
            paymentAmount: renewalFormData.paymentAmount
          },
          performedBy
        )
      } catch (logError) {
        console.error('Error logging membership renewal:', logError)
      }

      fetchUsers()
      toast.success('Membresía renovada exitosamente')
    } catch (error) {
      console.error('Error renewing membership:', error)
      toast.error('Error al renovar membresía')
    }
  }

  const handleChangeMembership = async () => {
    // Validate required fields
    if (!changeMembershipFormData.membershipType || !changeMembershipFormData.startDate || !changeMembershipFormData.endDate) {
      toast.error('Por favor completa todos los campos requeridos')
      return
    }

    // Save the data for logging BEFORE resetting the form
    const newMembershipData = {
      membershipType: changeMembershipFormData.membershipType,
      startDate: changeMembershipFormData.startDate,
      endDate: changeMembershipFormData.endDate,
      status: changeMembershipFormData.status
    }
    const oldMembershipData = {
      type: selectedUser.membershipType,
      startDate: selectedUser.membershipStartDate,
      endDate: selectedUser.membershipEndDate,
      status: selectedUser.membershipStatus
    }
    const userInfo = {
      id: selectedUser.id,
      membershipId: selectedUser.currentMembershipId,
      name: `${selectedUser.firstName} ${selectedUser.lastName}`
    }

    try {
      // Update the user's membership directly
      await usersService.updateUser(selectedUser.id, {
        membershipType: newMembershipData.membershipType,
        membershipStartDate: newMembershipData.startDate,
        membershipEndDate: newMembershipData.endDate,
        membershipStatus: newMembershipData.status
      })

      // If there's a current membership, update it as well
      if (selectedUser.currentMembershipId) {
        await membershipsService.updateMembership(selectedUser.currentMembershipId, {
          membershipType: newMembershipData.membershipType,
          startDate: newMembershipData.startDate,
          endDate: newMembershipData.endDate,
          status: newMembershipData.status,
          updateUser: true
        })
      }

      // Log the membership change BEFORE resetting state
      try {
        const performedBy = await getCurrentUserForLogging()
        await logsService.logMembershipChanged(
          userInfo.membershipId,
          userInfo.id,
          userInfo.name,
          oldMembershipData,
          {
            type: newMembershipData.membershipType,
            startDate: newMembershipData.startDate,
            endDate: newMembershipData.endDate,
            status: newMembershipData.status
          },
          performedBy
        )
      } catch (logError) {
        console.error('Error logging membership change:', logError)
      }

      // Reset form state after logging
      setShowChangeMembershipModal(false)
      setChangeMembershipFormData({
        membershipType: '',
        startDate: '',
        endDate: '',
        status: 'active'
      })

      toast.success('Membresía actualizada exitosamente')
      fetchUsers()
    } catch (error) {
      console.error('Error changing membership:', error)
      toast.error('Error al cambiar la membresía')
    }
  }

  const getTrainingGoalLabel = (goal) => {
    const goals = {
      // Database enum values
      'weight_loss': 'Pérdida de peso',
      'muscle_gain': 'Aumento de masa muscular',
      'general_fitness': 'Fitness general',
      'sports_performance': 'Rendimiento deportivo',
      'rehabilitation': 'Rehabilitación'
    }
    return goals[goal] || goal
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Usuarios</h1>
          <p className="text-sm text-text-secondary mt-1">Administra tus clientes activos y sus membresías</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            Crear Usuario
          </button>
          <button
            onClick={handleExport}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
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
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary" />
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
              <option value="active">Activo</option>
              <option value="expired">Vencido</option>
              <option value="cancelled">Cancelado</option>
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
                  <div className="h-8 w-8 bg-brand/10 rounded-full flex items-center justify-center mr-3">
                    <span className="text-brand font-medium text-sm">
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
              valueOptions: [
                { value: 'active', label: 'Activo' },
                { value: 'expired', label: 'Vencido' },
                { value: 'cancelled', label: 'Cancelado' }
              ],
              renderCell: (params) => (
                <span className={`status-badge ${getStatusColor(params.value)}`}>
                  {getStatusLabel(params.value)}
                </span>
              )
            },
            {
              field: 'assignedSellerId',
              headerName: 'Vendedor',
              width: 150,
              renderCell: (params) => (
                <span className="text-text-secondary text-sm">
                  {getSellerName(params.value)}
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
                    className="p-1.5 text-error hover:bg-error/10 rounded transition-colors"
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
              notes: params.row.notes || '',
              assignedSellerId: params.row.assignedSellerId || null
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
              await usersService.updateUser(newRow.id, {
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
          sx={dataGridStyles}
        />
      </div>

      {/* User Detail Side Panel */}
      {showSidePanel && selectedUser && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/30 z-40 animate-fade-in"
            onClick={() => setShowSidePanel(false)}
          />
          
          {/* Side Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-bg-secondary border-l border-border-default z-50 transform transition-transform duration-300 ease-in-out flex flex-col">
            {/* Header - Fixed */}
            <div className="p-6 border-b border-border-default shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-text-primary">
                  Detalles del Usuario
                </h3>
                <button
                  onClick={() => setShowSidePanel(false)}
                  className="text-text-tertiary hover:text-text-secondary"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* User Info - Editable Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-text-tertiary">Email</label>
                  <p className="text-lg font-medium text-text-primary">{selectedUser.email}</p>
                </div>

                <div className="border-t border-border-default pt-4">
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

                <div className="border-t border-border-default pt-4">
                  <label className="form-label">Vendedor Asignado</label>
                  <select
                    value={editFormData.assignedSellerId || ''}
                    onChange={(e) => handleFormChange('assignedSellerId', e.target.value || null)}
                    className="form-select w-full"
                  >
                    <option value="">Sin asignar</option>
                    {sellers.map(seller => (
                      <option key={seller.id} value={seller.id}>
                        {seller.first_name} {seller.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-border-default pt-4">
                  <label className="text-sm font-medium text-text-tertiary">Objetivo de entrenamiento</label>
                  <p className="text-text-primary">
                    {getTrainingGoalLabel(selectedUser.trainingGoal)}
                  </p>
                </div>

                <div className="border-t border-border-default pt-4">
                  <label className="text-sm font-medium text-text-tertiary">Membresía</label>
                  <p className="text-lg font-medium text-text-primary">
                    {getMembershipLabel(selectedUser.membershipType)}
                  </p>
                  <p className="text-sm text-text-secondary mt-1">
                    Estado: {getStatusLabel(selectedUser.membershipStatus)}
                  </p>
                </div>

                <div className="border-t border-border-default pt-4">
                  <label className="text-sm font-medium text-text-tertiary">Período de membresía</label>
                  <p className="text-text-primary">
                    {new Date(selectedUser.startDate).toLocaleDateString('es-AR')}
                  </p>
                  <p className="text-text-secondary text-sm">
                    hasta {new Date(selectedUser.endDate).toLocaleDateString('es-AR')}
                  </p>
                </div>

                <div className="border-t border-border-default pt-4">
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

                <div className="border-t border-border-default pt-4">
                  <label className="text-sm font-medium text-text-tertiary">Fecha de conversión</label>
                  <p className="text-text-primary">
                    {new Date(selectedUser.convertedAt).toLocaleString('es-AR')}
                  </p>
                </div>

                {/* UTM Parameters */}
                {(selectedUser.utmSource || selectedUser.utmMedium || selectedUser.utmCampaign || selectedUser.utmTerm || selectedUser.utmContent) && (
                  <div className="border-t border-border-default pt-4">
                    <label className="text-sm font-medium text-text-tertiary mb-2 block">Parámetros UTM</label>
                    <div className="bg-bg-surface rounded-lg p-3 space-y-2 text-sm">
                      {selectedUser.utmSource && (
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Source:</span>
                          <span className="font-medium text-text-primary">{selectedUser.utmSource}</span>
                        </div>
                      )}
                      {selectedUser.utmMedium && (
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Medium:</span>
                          <span className="font-medium text-text-primary">{selectedUser.utmMedium}</span>
                        </div>
                      )}
                      {selectedUser.utmCampaign && (
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Campaign:</span>
                          <span className="font-medium text-text-primary">{selectedUser.utmCampaign}</span>
                        </div>
                      )}
                      {selectedUser.utmTerm && (
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Term:</span>
                          <span className="font-medium text-text-primary">{selectedUser.utmTerm}</span>
                        </div>
                      )}
                      {selectedUser.utmContent && (
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Content:</span>
                          <span className="font-medium text-text-primary">{selectedUser.utmContent}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Activity Logs */}
                <div className="border-t border-border-default pt-4">
                  <LogsTimeline userId={selectedUser.id} limit={10} />
                </div>
              </div>

            </div>

            {/* Actions - Fixed Footer */}
            <div className="p-6 border-t border-border-default bg-bg-secondary shrink-0">
              <div className="space-y-3">
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
                    // Status is already in English in the database ('active', 'expired', 'cancelled')
                    const status = selectedUser.membershipStatus || 'active'
                    setChangeMembershipFormData({
                      membershipType: selectedUser.membershipType || '',
                      startDate: selectedUser.membershipStartDate || '',
                      endDate: selectedUser.membershipEndDate || '',
                      status: status
                    })
                    setShowChangeMembershipModal(true)
                    setShowSidePanel(false)
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Cambiar Membresía
                </button>
                <button
                  onClick={() => {
                    // Calculate dates: start = today, end = 1 month from today
                    const today = new Date()
                    const endDate = new Date(today)
                    endDate.setMonth(endDate.getMonth() + 1)
                    
                    // Get price for current membership type
                    const currentType = selectedUser.membershipType || 'mensual'
                    const calculatedPrice = getCalculatedPrice(currentType, 'efectivo')
                    
                    setRenewalFormData({
                      membershipType: currentType,
                      startDate: today.toISOString().split('T')[0],
                      endDate: endDate.toISOString().split('T')[0],
                      paymentMethod: 'efectivo',
                      paymentAmount: calculatedPrice || '',
                      paymentNotes: ''
                    })
                    setShowRenewalModal(true)
                    setShowSidePanel(false)
                  }}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Renovar Membresía
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
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-bg-secondary rounded-lg shadow-xl z-[70] p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-text-primary mb-4">
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
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-bg-secondary rounded-lg shadow-xl z-[70] w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header - Fixed */}
            <div className="p-6 border-b border-border-default shrink-0">
              <h3 className="text-xl font-bold text-text-primary">
                Crear Nuevo Usuario
              </h3>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Personal Info */}
                <div className="border-b border-border-default pb-4">
                  <h4 className="font-semibold text-text-primary mb-3">Información Personal</h4>
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
                      <option value="weight_loss">Pérdida de peso</option>
                      <option value="muscle_gain">Aumento de masa muscular</option>
                      <option value="general_fitness">Fitness general</option>
                      <option value="sports_performance">Rendimiento deportivo</option>
                      <option value="rehabilitation">Rehabilitación</option>
                    </select>
                  </div>
                </div>

                {/* Membership & Payment Combined */}
                <div className="border-b border-border-default pb-4">
                  <h4 className="font-semibold text-text-primary mb-3">Membresía y Pago</h4>
                  
                  {/* Membership Selection */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">Tipo de Membresía *</label>
                      <select
                        className="form-input"
                        value={createFormData.membershipType}
                        onChange={(e) => handleCreateFormChange('membershipType', e.target.value)}
                      >
                        {membershipPlans.map(plan => (
                          <option key={plan.id} value={plan.name}>
                            {plan.name} ({plan.durationMonths} {plan.durationMonths === 1 ? 'mes' : 'meses'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Fecha de Inicio *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={createFormData.startDate}
                        onChange={(e) => {
                          const startDate = new Date(e.target.value)
                          const endDate = new Date(startDate)
                          endDate.setMonth(endDate.getMonth() + 1)
                          setCreateFormData({
                            ...createFormData, 
                            startDate: e.target.value,
                            endDate: endDate.toISOString().split('T')[0]
                          })
                        }}
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
                      <p className="text-xs text-text-tertiary mt-1">
                        Por defecto: 1 mes desde inicio
                      </p>
                    </div>
                  </div>

                  {/* Payment Section */}
                  <div className="mt-4 pt-4 border-t border-border-default">
                    <div className="mb-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={createFormData.createPayment}
                          onChange={(e) => setCreateFormData({...createFormData, createPayment: e.target.checked})}
                          className="h-4 w-4 text-brand focus:ring-brand border-border-default rounded"
                        />
                        <span className="ml-2 text-sm text-text-secondary">Registrar pago inicial</span>
                      </label>
                    </div>

                    {createFormData.createPayment && (
                      <div className="space-y-4 bg-bg-surface/50 p-4 rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="form-label">Método de Pago *</label>
                            <select
                              className="form-input"
                              value={createFormData.paymentMethod}
                              onChange={(e) => handleCreateFormChange('paymentMethod', e.target.value)}
                            >
                              <option value="efectivo">Efectivo (Promo)</option>
                              <option value="debito_automatico">Débito Automático</option>
                              <option value="tarjeta_transferencia">Tarjeta / Transferencia</option>
                            </select>
                          </div>
                          <div>
                            <label className="form-label">Monto *</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary">$</span>
                              <input
                                type="number"
                                className="form-input pl-7"
                                value={createFormData.paymentAmount}
                                onChange={(e) => setCreateFormData({...createFormData, paymentAmount: e.target.value})}
                                placeholder="0"
                                step="1"
                              />
                            </div>
                            <p className="text-xs text-text-tertiary mt-1">
                              Precio sugerido. Editar para casos especiales.
                            </p>
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

                {/* Emergency Contact */}
                <div className="border-b border-border-default pb-4">
                  <h4 className="font-semibold text-text-primary mb-3">Contacto de Emergencia</h4>
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
                  <h4 className="font-semibold text-text-primary mb-3">Notas</h4>
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
              </div>
            </div>

            {/* Footer - Fixed/Sticky */}
            <div className="p-6 border-t border-border-default bg-bg-secondary shrink-0 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  const today = new Date()
                  const endDate = new Date(today)
                  endDate.setMonth(endDate.getMonth() + 1)
                  setCreateFormData({
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    trainingGoal: '',
                    membershipType: 'Socio_Basic',
                    startDate: today.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0],
                    emergencyContact: '',
                    emergencyPhone: '',
                    medicalNotes: '',
                    notes: '',
                    createPayment: true,
                    paymentMethod: 'efectivo',
                    paymentAmount: 60000,
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
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-bg-secondary rounded-lg shadow-xl z-[70] p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-text-primary mb-6">
              Renovar Membresía
            </h3>
            
            <div className="space-y-4">
              {/* Membership Info */}
              <div className="border-b border-border-default pb-4">
                <h4 className="font-semibold text-text-primary mb-3">Renovación de Membresía</h4>
                
                {/* Show current membership type as read-only */}
                <div className="mb-4 p-3 bg-bg-surface rounded-lg border border-border-default">
                  <p className="text-sm text-text-secondary">Tipo de Membresía</p>
                  <p className="text-lg font-semibold text-text-primary capitalize">{renewalFormData.membershipType}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Fecha de Inicio *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={renewalFormData.startDate}
                      onChange={(e) => {
                        const startDate = new Date(e.target.value)
                        const endDate = new Date(startDate)
                        endDate.setMonth(endDate.getMonth() + 1)
                        setRenewalFormData({
                          ...renewalFormData, 
                          startDate: e.target.value,
                          endDate: endDate.toISOString().split('T')[0]
                        })
                      }}
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
                    <p className="text-xs text-text-tertiary mt-1">
                      Por defecto: 1 mes desde inicio
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="border-b border-border-default pb-4">
                <h4 className="font-semibold text-text-primary mb-3">Información de Pago</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Método de Pago *</label>
                      <select
                        className="form-input"
                        value={renewalFormData.paymentMethod}
                        onChange={(e) => handleRenewalFormChange('paymentMethod', e.target.value)}
                      >
                        <option value="efectivo">Efectivo (Promo)</option>
                        <option value="debito_automatico">Débito Automático</option>
                        <option value="tarjeta_transferencia">Tarjeta / Transferencia</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Monto *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary">$</span>
                        <input
                          type="number"
                          className="form-input pl-7"
                          value={renewalFormData.paymentAmount}
                          onChange={(e) => setRenewalFormData({...renewalFormData, paymentAmount: e.target.value})}
                          placeholder="0"
                          step="1"
                        />
                      </div>
                      <p className="text-xs text-text-tertiary mt-1">
                        Precio sugerido. Editar para casos especiales.
                      </p>
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
                    membershipType: 'Socio',
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: '',
                    paymentMethod: 'efectivo',
                    paymentAmount: 55000,
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

      {/* Change Membership Modal */}
      {showChangeMembershipModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-70"
            onClick={() => setShowChangeMembershipModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-bg-secondary rounded-lg shadow-xl z-70 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-text-primary mb-6">
              Cambiar Membresía
            </h3>
            
            <div className="space-y-4">
              {/* Current User Info */}
              <div className="border-b border-border-default pb-4">
                <p className="text-sm text-text-secondary">
                  Usuario: <span className="font-semibold text-text-primary">{selectedUser?.firstName} {selectedUser?.lastName}</span>
                </p>
                <p className="text-sm text-text-secondary mt-1">
                  Membresía actual: <span className="font-semibold text-text-primary capitalize">{selectedUser?.membershipType}</span>
                </p>
                <p className="text-sm text-text-secondary mt-1">
                  Vence: <span className="font-semibold text-text-primary">
                    {selectedUser?.membershipEndDate ? new Date(selectedUser.membershipEndDate).toLocaleDateString('es-AR') : 'N/A'}
                  </span>
                </p>
              </div>

              {/* Membership Form */}
              <div className="space-y-4">
                <div>
                  <label className="form-label">Tipo de Membresía *</label>
                  <select
                    className="form-select"
                    value={changeMembershipFormData.membershipType}
                    onChange={(e) => setChangeMembershipFormData({...changeMembershipFormData, membershipType: e.target.value})}
                  >
                    <option value="">Seleccionar tipo</option>
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="mensual">Mensual</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                    <option value="socio_fundador">Socio Fundador</option>
                    <option value="sportclub">SportClub</option>
                    <option value="wellhub">Wellhub</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Fecha de Inicio *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={changeMembershipFormData.startDate}
                      onChange={(e) => setChangeMembershipFormData({...changeMembershipFormData, startDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="form-label">Fecha de Fin *</label>
                    <input
                      type="date"
                      className="form-input"
                      value={changeMembershipFormData.endDate}
                      onChange={(e) => setChangeMembershipFormData({...changeMembershipFormData, endDate: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Estado de Membresía *</label>
                  <select
                    className="form-select"
                    value={changeMembershipFormData.status}
                    onChange={(e) => setChangeMembershipFormData({...changeMembershipFormData, status: e.target.value})}
                  >
                    <option value="active">Activo</option>
                    <option value="expired">Vencido</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>

                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-warning shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-warning">Nota Importante</p>
                      <p className="text-xs text-text-secondary mt-1">
                        Esta acción modificará la membresía actual del usuario. Si necesitas crear una renovación con historial de pago, usa el botón "Renovar Membresía".
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowChangeMembershipModal(false)
                  setChangeMembershipFormData({
                    membershipType: '',
                    startDate: '',
                    endDate: '',
                    status: 'active'
                  })
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangeMembership}
                className="btn-primary"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </>
      )}

      <Toaster position="top-right" toastOptions={toastOptions} />
    </div>
  )
}

export default Users

