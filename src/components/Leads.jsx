import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { 
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import { leadsService } from '../services/leadsService'

const Leads = () => {
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
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [leadToConvert, setLeadToConvert] = useState(null)
  const [convertFormData, setConvertFormData] = useState({
    membershipType: 'mensual',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    emergencyContact: '',
    emergencyPhone: '',
    medicalNotes: ''
  })

  useEffect(() => {
    fetchLeads()
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
    try {
      await leadsService.updateLead(leadId, { status: newStatus })
      setLeads(leads.map(lead => 
        lead.id === leadId 
          ? { ...lead, attributes: { ...lead.attributes, status: newStatus } }
          : lead
      ))
    } catch (error) {
      console.error('Error updating lead status:', error)
    }
  }

  const handleDeleteLead = async (leadId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este lead?')) {
      try {
        await leadsService.deleteLead(leadId)
        setLeads(leads.filter(lead => lead.id !== leadId))
      } catch (error) {
        console.error('Error deleting lead:', error)
      }
    }
  }

  const handleOpenConvertModal = (lead) => {
    setLeadToConvert(lead)
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 1)
    setConvertFormData({
      membershipType: 'mensual',
      startDate: new Date().toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      emergencyContact: '',
      emergencyPhone: '',
      medicalNotes: ''
    })
    setShowConvertModal(true)
  }

  const handleConvertToUser = async () => {
    try {
      await leadsService.convertToUser(leadToConvert.id, leadToConvert, convertFormData)
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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Leads</h1>
          <p className="text-gray-600">Administra y sigue el progreso de tus leads</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <label className="form-label">Filtrar por estado</label>
            <select
              className="form-input"
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
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lead
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contacto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Objetivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-medium">
                          {lead.firstName?.charAt(0) || lead.first_name?.charAt(0) || 'L'}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {lead.firstName} {lead.lastName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{lead.email}</div>
                    <div className="text-sm text-gray-500">{lead.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {getTrainingGoalLabel(lead.trainingGoal)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      className={`status-badge ${getStatusColor(lead.status)} border-0 bg-transparent`}
                    >
                      <option value="nuevo">Nuevo</option>
                      <option value="contactado">Contactado</option>
                      <option value="convertido">Convertido</option>
                      <option value="perdido">Perdido</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(lead.submittedAt).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {!lead.convertedToUser && lead.status !== 'convertido' && (
                        <button
                          onClick={() => handleOpenConvertModal(lead)}
                          className="text-green-600 hover:text-green-900"
                          title="Marcar como convertido"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedLead(lead)
                          setEditingStatus(lead.status)
                          setEditFormData({
                            firstName: lead.firstName || '',
                            lastName: lead.lastName || '',
                            phone: lead.phone || '',
                            notes: lead.notes || ''
                          })
                          setHasChanges(false)
                          setShowSidePanel(true)
                        }}
                        className="text-sky-600 hover:text-sky-900"
                        title="Ver detalles y editar"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteLead(lead.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Eliminar"
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

      {/* Lead Detail Side Panel */}
      {showSidePanel && selectedLead && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-white/70 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setShowSidePanel(false)}
          />
          
          {/* Side Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-[#edeaea] z-50 transform transition-transform duration-300 ease-in-out flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-bold text-gray-900">
                Detalles del Lead
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

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Email (Read-only) */}
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-lg font-medium text-gray-900">{selectedLead.email}</p>
                </div>

                {/* Editable Fields */}
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

                {/* Read-only Objetivo de entrenamiento */}
                <div className="border-t border-[#edeaea] pt-4">
                  <label className="text-sm font-medium text-gray-500">Objetivo de entrenamiento</label>
                  <p className="text-gray-900">
                    {getTrainingGoalLabel(selectedLead.trainingGoal)}
                  </p>
                </div>

                {/* Status Editor */}
                <div className="border-t border-[#edeaea] pt-4">
                  <label className="text-sm font-medium text-gray-500 block mb-2">Estado del Lead</label>
                  <select
                    value={editingStatus}
                    onChange={(e) => setEditingStatus(e.target.value)}
                    className="form-input w-full"
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
                <div className="border-t border-[#edeaea] pt-4">
                  <label className="text-sm font-medium text-gray-500">Fecha de envío</label>
                  <p className="text-gray-900">
                    {new Date(selectedLead.submittedAt).toLocaleString('es-AR')}
                  </p>
                </div>

                {selectedLead.lastContactedAt && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Último contacto</label>
                    <p className="text-gray-900">
                      {new Date(selectedLead.lastContactedAt).toLocaleString('es-AR')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Fixed Actions at Bottom */}
            <div className="border-t border-[#edeaea] bg-white p-6 space-y-3">
              {hasChanges && (
                <button
                  onClick={handleSaveEdit}
                  className="btn-primary w-full"
                >
                  Confirmar edición
                </button>
              )}
              {!selectedLead.convertedToUser && selectedLead.status !== 'convertido' && (
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
          </div>
        </>
      )}

      {/* Convert to User Side Panel */}
      {showConvertModal && leadToConvert && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-white/70 backdrop-blur-sm z-[60]"
            onClick={() => setShowConvertModal(false)}
          />
          
          {/* Side Panel */}
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[60] overflow-y-auto transform transition-transform duration-300 ease-in-out">
            <div className="p-6">
              {/* Header with Close Button */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Convertir a Usuario
                </h3>
                <button
                  onClick={() => setShowConvertModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            
            {/* Email Display */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <label className="text-xs font-medium text-green-700 uppercase tracking-wide">Email</label>
              <p className="text-lg font-semibold text-green-900 mt-1">{leadToConvert.email}</p>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Completa los datos de membresía para convertir este lead en cliente
            </p>
            <div className="space-y-3">
              <div>
                <label className="form-label">Tipo de Membresía *</label>
                <select
                  className="form-input"
                  value={convertFormData.membershipType}
                  onChange={(e) => setConvertFormData({...convertFormData, membershipType: e.target.value})}
                  required
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
                  value={convertFormData.startDate}
                  onChange={(e) => setConvertFormData({...convertFormData, startDate: e.target.value})}
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
              </div>
              <div>
                <label className="form-label">Contacto de Emergencia</label>
                <input
                  type="text"
                  className="form-input"
                  value={convertFormData.emergencyContact}
                  onChange={(e) => setConvertFormData({...convertFormData, emergencyContact: e.target.value})}
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="form-label">Teléfono de Emergencia</label>
                <input
                  type="tel"
                  className="form-input"
                  value={convertFormData.emergencyPhone}
                  onChange={(e) => setConvertFormData({...convertFormData, emergencyPhone: e.target.value})}
                  placeholder="+54 11 1234-5678"
                />
              </div>
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
            <div className="mt-6 flex justify-end space-x-3">
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
            </div>
          </div>
        </>
      )}

      <Toaster position="top-right" />
    </div>
  )
}

export default Leads
