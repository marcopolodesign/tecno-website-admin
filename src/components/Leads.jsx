import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { 
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  CheckIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import { DataGrid } from '@mui/x-data-grid'
import { leadsService } from '../services/leadsService'
import { sellersService } from '../services/sellersService'
import membershipPlansService from '../services/membershipPlansService'
import { dataGridStyles, toastOptions } from '../lib/themeStyles'
import Sidecart from './Sidecart'
import Modal from './Modal'

const Leads = ({ userRole }) => {
  const [leads, setLeads] = useState([])
  const [filteredLeads, setFilteredLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedLead, setSelectedLead] = useState(null)
  const [showSidePanel, setShowSidePanel] = useState(false)
  const [editingStatus, setEditingStatus] = useState('')
  const [editFormData, setEditFormData] = useState({})
  const [hasChanges, setHasChanges] = useState(false)
  const [sellers, setSellers] = useState([])
  const [membershipPlans, setMembershipPlans] = useState([])
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [leadToConvert, setLeadToConvert] = useState(null)
  const [convertFormData, setConvertFormData] = useState({
    membershipType: 'Socio_Basic',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    emergencyContact: '',
    emergencyPhone: '',
    medicalNotes: '',
    paymentMethod: 'efectivo',
    paymentAmount: '',
    paymentNotes: ''
  })
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [reasonData, setReasonData] = useState({
    leadId: null,
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
    notes: '',
    source: 'manual'
  })

  useEffect(() => {
    fetchLeads()
    fetchSellers()
    fetchMembershipPlans()
  }, [])

  useEffect(() => {
    filterLeads()
  }, [leads, searchTerm, statusFilter])

  const fetchLeads = async () => {
    try {
      const response = await leadsService.getLeads()
      setLeads(response.data || [])
    } catch (error) {
      console.error('Error fetching leads:', error)
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

  // Handle membership type or payment method change with auto-price
  const handleConvertFormChange = (field, value) => {
    const newFormData = { ...convertFormData, [field]: value }
    
    // Auto-calculate price when membership type or payment method changes
    if (field === 'membershipType' || field === 'paymentMethod') {
      const planName = field === 'membershipType' ? value : convertFormData.membershipType
      const method = field === 'paymentMethod' ? value : convertFormData.paymentMethod
      const calculatedPrice = getCalculatedPrice(planName, method)
      newFormData.paymentAmount = calculatedPrice
    }
    
    setConvertFormData(newFormData)
  }

  const getSellerName = (sellerId) => {
    if (!sellerId) return 'Sin asignar'
    const seller = sellers.find(s => s.id === sellerId)
    return seller ? `${seller.first_name} ${seller.last_name}` : 'Sin asignar'
  }

  const filterLeads = () => {
    let filtered = leads

    if (searchTerm) {
      filtered = filtered.filter(lead => 
        lead.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone.includes(searchTerm)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter)
    }

    setFilteredLeads(filtered)
  }

  const handleStatusChange = async (leadId, newStatus) => {
    // If changing to "perdido", ask for reason
    if (newStatus === 'perdido') {
      setReasonData({
        leadId,
        newStatus,
        reason: ''
      })
      setShowReasonModal(true)
      return
    }

    // For other statuses, update directly
    try {
      await leadsService.updateLead(leadId, { status: newStatus })
      setLeads(leads.map(lead => 
        lead.id === leadId 
          ? { ...lead, status: newStatus }
          : lead
      ))
      toast.success('Estado actualizado')
    } catch (error) {
      console.error('Error updating lead status:', error)
      toast.error('Error al actualizar estado')
    }
  }

  const handleConfirmStatusWithReason = async () => {
    if (!reasonData.reason.trim()) {
      toast.error('Por favor ingresa una razón')
      return
    }

    try {
      await leadsService.updateLead(reasonData.leadId, { 
        status: reasonData.newStatus,
        lostReason: reasonData.reason
      })
      setLeads(leads.map(lead => 
        lead.id === reasonData.leadId 
          ? { ...lead, status: reasonData.newStatus, lostReason: reasonData.reason }
          : lead
      ))
      setShowReasonModal(false)
      setReasonData({ leadId: null, newStatus: '', reason: '' })
      toast.success('Estado actualizado')
    } catch (error) {
      console.error('Error updating lead status:', error)
      toast.error('Error al actualizar estado')
    }
  }

  const handleDeleteLead = async (leadId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este lead?')) {
      try {
        await leadsService.deleteLead(leadId)
        setLeads(leads.filter(lead => lead.id !== leadId))
        toast.success('Lead eliminado exitosamente')
      } catch (error) {
        console.error('Error deleting lead:', error)
        toast.error('Error al eliminar lead')
      }
    }
  }

  const handleCreateLead = async () => {
    // Validate required fields
    if (!createFormData.firstName || !createFormData.email || !createFormData.phone || !createFormData.trainingGoal) {
      toast.error('Por favor completa todos los campos requeridos')
      return
    }

    try {
      const response = await leadsService.createLead(createFormData)
      setLeads([response.data, ...leads])
      setShowCreateModal(false)
      setCreateFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        trainingGoal: '',
        notes: '',
        source: 'manual'
      })
      toast.success('Lead creado exitosamente')
    } catch (error) {
      console.error('Error creating lead:', error)
      toast.error('Error al crear lead')
    }
  }

  const handleOpenConvertModal = (lead) => {
    setLeadToConvert(lead)
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 1)
    
    // Default to Socio_Basic for new members with efectivo payment
    const defaultPlan = 'Socio_Basic'
    const defaultPaymentMethod = 'efectivo'
    const initialPrice = getCalculatedPrice(defaultPlan, defaultPaymentMethod)
    
    setConvertFormData({
      membershipType: defaultPlan,
      startDate: new Date().toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      emergencyContact: '',
      emergencyPhone: '',
      medicalNotes: '',
      paymentMethod: defaultPaymentMethod,
      paymentAmount: initialPrice || 60000,
      paymentNotes: ''
    })
    setShowConvertModal(true)
  }

  const handleConvertToUser = async () => {
    try {
      const paymentData = {
        amount: convertFormData.paymentAmount,
        paymentMethod: convertFormData.paymentMethod,
        paymentDate: new Date().toISOString(),
        notes: convertFormData.paymentNotes
      }
      
      await leadsService.convertToUser(leadToConvert.id, leadToConvert, convertFormData, paymentData)
      setShowConvertModal(false)
      fetchLeads()
      alert('¡Lead convertido a Usuario exitosamente!')
    } catch (error) {
      console.error('Error converting lead:', error)
      alert('Error al convertir lead. Verifica que los datos estén completos.')
    }
  }

  const handleUpdateStatus = async () => {
    try {
      await leadsService.updateLead(selectedLead.documentId, { 
        status: editingStatus,
        lastContactedAt: new Date().toISOString()
      })
      setLeads(leads.map(lead => 
        lead.id === selectedLead.id 
          ? { ...lead, status: editingStatus, lastContactedAt: new Date().toISOString() }
          : lead
      ))
      alert('Estado actualizado exitosamente!')
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Error al actualizar el estado.')
    }
  }

  const handleFormChange = (field, value) => {
    const newFormData = { ...editFormData, [field]: value }
    setEditFormData(newFormData)
    
    // Check if there are changes
    const hasAnyChanges = Object.keys(newFormData).some(key => {
      return newFormData[key] !== (selectedLead[key] || '')
    })
    setHasChanges(hasAnyChanges)
  }

  const handleSaveEdit = async () => {
    try {
      await leadsService.updateLead(selectedLead.documentId, editFormData)
      setLeads(leads.map(l => 
        l.id === selectedLead.id 
          ? { ...l, ...editFormData }
          : l
      ))
      setSelectedLead({ ...selectedLead, ...editFormData })
      setHasChanges(false)
      toast.success('Lead actualizado exitosamente!')
      setShowSidePanel(false)
    } catch (error) {
      console.error('Error updating lead:', error)
      toast.error('Error al actualizar lead.')
    }
  }

  const handleExport = async () => {
    try {
      const response = await leadsService.exportLeads()
      const leadsData = response.data || []
      
      const csvContent = [
        ['Nombre', 'Apellido', 'Email', 'Teléfono', 'Objetivo', 'Estado', 'Fecha'],
        ...leadsData.map(lead => [
          lead.firstName,
          lead.lastName,
          lead.email,
          lead.phone,
          lead.trainingGoal,
          lead.status,
          new Date(lead.submittedAt).toLocaleDateString('es-AR')
        ])
      ].map(row => row.join(',')).join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads-tecnofit-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting leads:', error)
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
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Leads</h1>
          <p className="text-sm text-text-secondary mt-1">Administra y sigue el progreso de tus leads</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            Crear Lead
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Buscar</label>
            <div className="relative">
              <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                className="form-input pl-9"
                placeholder="Buscar por nombre, email o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="form-label">Filtrar por estado</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="nuevo">Nuevo</option>
              <option value="contactado">Contactado</option>
              <option value="convertido">Convertido</option>
              <option value="perdido">Perdido</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="card p-0 overflow-hidden" style={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredLeads}
          columns={[
            {
              field: 'fullName',
              headerName: 'Lead',
              width: 200,
              valueGetter: (value, row) => `${row.firstName || ''} ${row.lastName || ''}`,
              renderCell: (params) => (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-warning/10 rounded-full flex items-center justify-center">
                    <span className="text-warning font-medium text-sm">
                      {params.row.firstName?.charAt(0) || 'L'}
                    </span>
                  </div>
                  <span className="text-text-primary">{params.value}</span>
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
              field: 'trainingGoal',
              headerName: 'Objetivo',
              width: 200,
              valueGetter: (value) => getTrainingGoalLabel(value)
            },
            {
              field: 'status',
              headerName: 'Estado',
              width: 150,
              editable: true,
              type: 'singleSelect',
              valueOptions: ['nuevo', 'contactado', 'convertido', 'perdido'],
              renderCell: (params) => (
                <span className={`status-badge ${getStatusColor(params.value)}`}>
                  {getStatusLabel(params.value)}
                </span>
              )
            },
            {
              field: 'emailSent',
              headerName: 'Email',
              width: 80,
              renderCell: (params) => (
                <div className="flex items-center justify-center">
                  {params.value ? (
                    <div className="flex items-center text-brand">
                      <CheckIcon className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="flex items-center text-text-tertiary">
                      <div className="h-4 w-4 border border-border-default rounded-full"></div>
                    </div>
                  )}
                </div>
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
              field: 'submittedAt',
              headerName: 'Fecha',
              width: 120,
              valueFormatter: (value) => new Date(value).toLocaleDateString('es-AR')
            },
            {
              field: 'actions',
              headerName: 'Acciones',
              width: 150,
              sortable: false,
              renderCell: (params) => (
                <div className="flex gap-2">
                  {!params.row.convertedToUser && params.row.status !== 'convertido' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenConvertModal(params.row)
                      }}
                      className="p-1.5 text-brand hover:bg-brand/10 rounded transition-colors"
                      title="Marcar como convertido"
                    >
                      <CheckIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteLead(params.row.id)
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
            setSelectedLead(params.row)
            setEditingStatus(params.row.status)
            setEditFormData({
              firstName: params.row.firstName || '',
              lastName: params.row.lastName || '',
              phone: params.row.phone || '',
              notes: params.row.notes || '',
              assignedSellerId: params.row.assignedSellerId || null
            })
            setHasChanges(false)
            setShowSidePanel(true)
          }}
          processRowUpdate={async (newRow, oldRow) => {
            // Handle status change with reason if needed
            if (newRow.status !== oldRow.status && newRow.status === 'perdido') {
              setReasonData({
                leadId: newRow.id,
                newStatus: 'perdido',
                reason: ''
              })
              setShowReasonModal(true)
              return oldRow // Return old row, will update after reason is provided
            }
            
            // Handle other edits
            try {
              await leadsService.updateLead(newRow.documentId, {
                firstName: newRow.firstName,
                lastName: newRow.lastName,
                phone: newRow.phone,
                status: newRow.status
              })
              setLeads(leads.map(l => l.id === newRow.id ? newRow : l))
              toast.success('Lead actualizado')
              return newRow
            } catch (error) {
              console.error('Error updating lead:', error)
              toast.error('Error al actualizar lead')
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

      {/* Lead Detail Side Panel */}
      <Sidecart
        isOpen={showSidePanel && !!selectedLead}
        onClose={() => setShowSidePanel(false)}
        title="Detalles del Lead"
        footer={
          <div className="space-y-3">
            {hasChanges && (
              <button
                onClick={handleSaveEdit}
                className="btn-primary w-full"
              >
                Confirmar edición
              </button>
            )}
            {selectedLead && !selectedLead.convertedToUser && selectedLead.status !== 'convertido' && (
              <button
                onClick={() => {
                  setShowSidePanel(false)
                  handleOpenConvertModal(selectedLead)
                }}
                className="btn-primary w-full flex items-center justify-center"
              >
                <CheckIcon className="h-5 w-5 mr-2" />
                Marcar como Convertido
              </button>
            )}
            <button
              onClick={() => setShowSidePanel(false)}
              className="btn-secondary w-full"
            >
              Cerrar
            </button>
          </div>
        }
      >
        {selectedLead && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Email</label>
              <p className="text-sm font-medium text-text-primary mt-1">{selectedLead.email}</p>
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
              <label className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Objetivo de entrenamiento</label>
              <p className="text-sm text-text-primary mt-1">
                {getTrainingGoalLabel(selectedLead.trainingGoal)}
              </p>
            </div>

            <div className="border-t border-border-default pt-4">
              <label className="form-label">Estado del Lead</label>
              <select
                value={editingStatus}
                onChange={(e) => setEditingStatus(e.target.value)}
                className="form-select w-full"
              >
                <option value="nuevo">Nuevo</option>
                <option value="contactado">Contactado</option>
                <option value="en-negociacion">En negociación</option>
                <option value="convertido">Convertido</option>
                <option value="perdido">Perdido</option>
              </select>
              {editingStatus !== selectedLead.status && (
                <button
                  onClick={handleUpdateStatus}
                  className="mt-2 btn-primary w-full"
                >
                  Guardar Estado
                </button>
              )}
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

            <div>
              <label className="form-label">Notas</label>
              <textarea
                className="form-input"
                rows="3"
                value={editFormData.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
              />
            </div>

            {/* Read-only info */}
            <div className="border-t border-border-default pt-4">
              <label className="text-sm font-medium text-text-tertiary">Fecha de envío</label>
              <p className="text-text-primary">
                {new Date(selectedLead.submittedAt).toLocaleString('es-AR')}
              </p>
            </div>

            {selectedLead.lastContactedAt && (
              <div>
                <label className="text-sm font-medium text-text-tertiary">Último contacto</label>
                <p className="text-text-primary">
                  {new Date(selectedLead.lastContactedAt).toLocaleString('es-AR')}
                </p>
              </div>
            )}

            {/* UTM Parameters */}
            {(selectedLead.utmSource || selectedLead.utmMedium || selectedLead.utmCampaign || selectedLead.utmTerm || selectedLead.utmContent) && (
              <div className="border-t border-border-default pt-4">
                <label className="text-sm font-medium text-text-tertiary mb-2 block">Parámetros UTM</label>
                <div className="bg-bg-surface rounded-lg p-3 space-y-2 text-sm">
                  {selectedLead.utmSource && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Source:</span>
                      <span className="font-medium text-text-primary">{selectedLead.utmSource}</span>
                    </div>
                  )}
                  {selectedLead.utmMedium && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Medium:</span>
                      <span className="font-medium text-text-primary">{selectedLead.utmMedium}</span>
                    </div>
                  )}
                  {selectedLead.utmCampaign && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Campaign:</span>
                      <span className="font-medium text-text-primary">{selectedLead.utmCampaign}</span>
                    </div>
                  )}
                  {selectedLead.utmTerm && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Term:</span>
                      <span className="font-medium text-text-primary">{selectedLead.utmTerm}</span>
                    </div>
                  )}
                  {selectedLead.utmContent && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Content:</span>
                      <span className="font-medium text-text-primary">{selectedLead.utmContent}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Sidecart>

      {/* Convert to User Sidecart */}
      <Sidecart
        isOpen={showConvertModal && !!leadToConvert}
        onClose={() => setShowConvertModal(false)}
        title="Convertir a Usuario"
        subtitle="Completa los datos de membresía para convertir este lead en cliente"
        zIndex={60}
        headerContent={
          leadToConvert && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <label className="text-xs font-medium text-green-700 uppercase tracking-wide">Email</label>
              <p className="text-lg font-semibold text-green-900 mt-1">{leadToConvert.email}</p>
            </div>
          )
        }
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowConvertModal(false)}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={handleConvertToUser}
              className="btn-primary"
              disabled={!convertFormData.membershipType || !convertFormData.startDate || !convertFormData.endDate}
            >
              Convertir a Usuario
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Membership & Payment Combined */}
          <div className="border-b border-border-default pb-4">
            <h4 className="font-semibold text-text-primary mb-3">Membresía y Pago</h4>
            
            {/* Membership Selection */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="form-label">Tipo de Membresía *</label>
                <select
                  className="form-select"
                  value={convertFormData.membershipType}
                  onChange={(e) => handleConvertFormChange('membershipType', e.target.value)}
                  required
                >
                  {membershipPlans.map(plan => (
                    <option key={plan.id} value={plan.name}>
                      {plan.name} ({plan.durationMonths} {plan.durationMonths === 1 ? 'mes' : 'meses'})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Fecha de Inicio *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={convertFormData.startDate}
                    onChange={(e) => {
                      const startDate = new Date(e.target.value)
                      const endDate = new Date(startDate)
                      endDate.setMonth(endDate.getMonth() + 1)
                      setConvertFormData({
                        ...convertFormData, 
                        startDate: e.target.value,
                        endDate: endDate.toISOString().split('T')[0]
                      })
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Fecha de Fin *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={convertFormData.endDate}
                    onChange={(e) => setConvertFormData({...convertFormData, endDate: e.target.value})}
                    required
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    Por defecto: 1 mes desde inicio
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Section */}
            <div className="mt-4 pt-4 border-t border-border-default">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Método de Pago *</label>
                  <select
                    className="form-select"
                    value={convertFormData.paymentMethod}
                    onChange={(e) => handleConvertFormChange('paymentMethod', e.target.value)}
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
                      className={`form-input pl-7 ${userRole === 'front_desk' ? 'bg-bg-surface cursor-not-allowed' : ''}`}
                      value={convertFormData.paymentAmount}
                      onChange={(e) => {
                        if (userRole !== 'front_desk') {
                          setConvertFormData({...convertFormData, paymentAmount: e.target.value})
                        }
                      }}
                      placeholder="0"
                      step="1"
                      readOnly={userRole === 'front_desk'}
                    />
                  </div>
                  <p className="text-xs text-text-tertiary mt-1">
                    {userRole === 'front_desk' 
                      ? 'Precio calculado automáticamente según plan y método de pago.'
                      : 'Precio sugerido. Editar para casos especiales.'}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <label className="form-label">Notas de Pago</label>
                <textarea
                  className="form-input"
                  rows="2"
                  value={convertFormData.paymentNotes}
                  onChange={(e) => setConvertFormData({...convertFormData, paymentNotes: e.target.value})}
                  placeholder="Información adicional sobre el pago..."
                />
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="border-b border-border-default pb-4">
            <h4 className="font-semibold text-text-primary mb-3">Contacto de Emergencia</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Nombre del Contacto</label>
                <input
                  type="text"
                  className="form-input"
                  value={convertFormData.emergencyContact}
                  onChange={(e) => setConvertFormData({...convertFormData, emergencyContact: e.target.value})}
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="form-label">Teléfono</label>
                <input
                  type="tel"
                  className="form-input"
                  value={convertFormData.emergencyPhone}
                  onChange={(e) => setConvertFormData({...convertFormData, emergencyPhone: e.target.value})}
                  placeholder="+54 11 1234-5678"
                />
              </div>
            </div>
          </div>

          {/* Medical Notes */}
          <div>
            <h4 className="font-semibold text-text-primary mb-3">Notas</h4>
            <div>
              <label className="form-label">Notas Médicas</label>
              <textarea
                className="form-input"
                value={convertFormData.medicalNotes}
                onChange={(e) => setConvertFormData({...convertFormData, medicalNotes: e.target.value})}
                rows="3"
                placeholder="Alergias, lesiones, condiciones médicas..."
              />
            </div>
          </div>
        </div>
      </Sidecart>

      {/* Reason Modal */}
      <Modal
        isOpen={showReasonModal}
        onClose={() => {
          setShowReasonModal(false)
          setReasonData({ leadId: null, newStatus: '', reason: '' })
        }}
        title="¿Por qué se marcó como perdido?"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowReasonModal(false)
                setReasonData({ leadId: null, newStatus: '', reason: '' })
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
        }
      >
        <textarea
          className="form-input w-full"
          rows="4"
          placeholder="Ingresa la razón..."
          value={reasonData.reason}
          onChange={(e) => setReasonData({...reasonData, reason: e.target.value})}
        />
      </Modal>

      {/* Create Lead Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setCreateFormData({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            trainingGoal: '',
            notes: '',
            source: 'manual'
          })
        }}
        title="Crear Nuevo Lead"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setShowCreateModal(false)
                setCreateFormData({
                  firstName: '',
                  lastName: '',
                  email: '',
                  phone: '',
                  trainingGoal: '',
                  notes: '',
                  source: 'manual'
                })
              }}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateLead}
              className="btn-primary"
            >
              Crear Lead
            </button>
          </div>
        }
      >
        <div className="space-y-4">
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

          <div>
            <label className="form-label">Objetivo de entrenamiento *</label>
            <select
              className="form-select"
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

          <div>
            <label className="form-label">Notas</label>
            <textarea
              className="form-textarea"
              rows="3"
              value={createFormData.notes}
              onChange={(e) => setCreateFormData({...createFormData, notes: e.target.value})}
              placeholder="Información adicional..."
            />
          </div>
        </div>
      </Modal>

      <Toaster position="top-right" toastOptions={toastOptions} />
    </div>
  )
}

export default Leads
