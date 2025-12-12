import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { 
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'
import { DataGrid } from '@mui/x-data-grid'
import { prospectsService } from '../services/prospectsService'
import { sellersService } from '../services/sellersService'

const Prospects = () => {
  const [prospects, setProspects] = useState([])
  const [filteredProspects, setFilteredProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [convertedFilter, setConvertedFilter] = useState('all')
  const [selectedProspect, setSelectedProspect] = useState(null)
  const [showSidePanel, setShowSidePanel] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [prospectToConvert, setProspectToConvert] = useState(null)
  const [sellers, setSellers] = useState([])
  const [editFormData, setEditFormData] = useState({})
  const [hasChanges, setHasChanges] = useState(false)
  const [convertFormData, setConvertFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    trainingGoal: '',
    seller: null
  })

  useEffect(() => {
    fetchProspects()
    fetchSellers()
  }, [])

  useEffect(() => {
    filterProspects()
  }, [prospects, searchTerm, convertedFilter])

  const fetchProspects = async () => {
    try {
      const response = await prospectsService.getProspects()
      setProspects(response.data || [])
    } catch (error) {
      console.error('Error fetching prospects:', error)
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

  const handleOpenConvertModal = (prospect) => {
    setProspectToConvert(prospect)
    setConvertFormData({
      firstName: prospect.firstName || '',
      lastName: prospect.lastName || '',
      phone: prospect.phone || '',
      trainingGoal: prospect.trainingGoal || '',
      seller: null
    })
    setShowConvertModal(true)
  }

  const handleConvertToLead = async () => {
    try {
      await prospectsService.convertToLead(prospectToConvert.id, prospectToConvert, convertFormData)
      setShowConvertModal(false)
      fetchProspects() // Refresh list
      alert('¡Prospect convertido a Lead exitosamente!')
    } catch (error) {
      console.error('Error converting prospect:', error)
      alert('Error al convertir prospect. Verifica que los datos estén completos.')
    }
  }

  const filterProspects = () => {
    let filtered = prospects

    if (searchTerm) {
      filtered = filtered.filter(prospect => 
        (prospect.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (prospect.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        prospect.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (prospect.phone?.includes(searchTerm) || false)
      )
    }

    if (convertedFilter !== 'all') {
      const isConverted = convertedFilter === 'converted'
      filtered = filtered.filter(prospect => prospect.convertedToLead === isConverted)
    }

    setFilteredProspects(filtered)
  }

  const handleDeleteProspect = async (prospect) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este prospect?')) {
      try {
        await prospectsService.deleteProspect(prospect.documentId)
        setProspects(prospects.filter(p => p.id !== prospect.id))
      } catch (error) {
        console.error('Error deleting prospect:', error)
      }
    }
  }

  const handleFormChange = (field, value) => {
    const newFormData = { ...editFormData, [field]: value }
    setEditFormData(newFormData)
    
    // Check if there are changes
    const hasAnyChanges = Object.keys(newFormData).some(key => {
      return newFormData[key] !== (selectedProspect[key] || '')
    })
    setHasChanges(hasAnyChanges)
  }

  const handleSaveEdit = async () => {
    try {
      await prospectsService.updateProspect(selectedProspect.documentId, editFormData)
      setProspects(prospects.map(p => 
        p.id === selectedProspect.id 
          ? { ...p, ...editFormData }
          : p
      ))
      setSelectedProspect({ ...selectedProspect, ...editFormData })
      setHasChanges(false)
      toast.success('Prospect actualizado exitosamente!')
      setShowSidePanel(false)
    } catch (error) {
      console.error('Error updating prospect:', error)
      toast.error('Error al actualizar prospect.')
    }
  }

  const handleExport = async () => {
    try {
      const response = await prospectsService.getProspects()
      const prospectsData = response.data || []
      
      const csvContent = [
        ['Email', 'Nombre', 'Apellido', 'Teléfono', 'Objetivo', 'Convertido', 'Fecha'],
        ...prospectsData.map(prospect => [
          prospect.email,
          prospect.firstName || '',
          prospect.lastName || '',
          prospect.phone || '',
          prospect.trainingGoal || '',
          prospect.convertedToLead ? 'Sí' : 'No',
          new Date(prospect.capturedAt).toLocaleDateString('es-AR')
        ])
      ].map(row => row.join(',')).join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prospects-tecnofit-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting prospects:', error)
    }
  }

  const getTrainingGoalLabel = (goal) => {
    if (!goal) return 'No especificado'
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
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Prospects</h1>
          <p className="text-gray-600">Usuarios que mostraron interés pero no completaron el formulario</p>
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
            <label className="form-label">Filtrar por conversión</label>
            <select
              className="form-input"
              value={convertedFilter}
              onChange={(e) => setConvertedFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="not-converted">No convertidos</option>
              <option value="converted">Convertidos a Lead</option>
            </select>
          </div>
        </div>
      </div>

      {/* Prospects Table */}
      <div className="card" style={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredProspects}
          columns={[
            {
              field: 'fullName',
              headerName: 'Prospect',
              width: 200,
              valueGetter: (value, row) => `${row.firstName || 'Sin nombre'} ${row.lastName || ''}`,
              renderCell: (params) => (
                <div className="flex items-center">
                  <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-purple-600 font-medium text-sm">
                      {params.row.firstName?.charAt(0) || params.row.email.charAt(0).toUpperCase()}
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
              editable: true,
              valueGetter: (value) => value || 'No proporcionado'
            },
            {
              field: 'trainingGoal',
              headerName: 'Objetivo',
              width: 200,
              valueGetter: (value) => getTrainingGoalLabel(value)
            },
            {
              field: 'convertedToLead',
              headerName: 'Estado',
              width: 130,
              renderCell: (params) => (
                <span className={`status-badge ${params.value ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {params.value ? 'Convertido' : 'Pendiente'}
                </span>
              )
            },
            {
              field: 'capturedAt',
              headerName: 'Fecha',
              width: 120,
              valueFormatter: (value) => new Date(value).toLocaleDateString('es-AR')
            },
            {
              field: 'actions',
              headerName: 'Acciones',
              width: 120,
              sortable: false,
              renderCell: (params) => (
                <div className="flex space-x-2">
                  {!params.row.convertedToLead && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenConvertModal(params.row)
                      }}
                      className="text-green-600 hover:text-green-900"
                      title="Convertir a Lead"
                    >
                      <ArrowRightIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteProspect(params.row)
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
            setSelectedProspect(params.row)
            setEditFormData({
              firstName: params.row.firstName || '',
              lastName: params.row.lastName || '',
              phone: params.row.phone || '',
              trainingGoal: params.row.trainingGoal || '',
              notes: params.row.notes || ''
            })
            setHasChanges(false)
            setShowSidePanel(true)
          }}
          processRowUpdate={async (newRow, oldRow) => {
            try {
              await prospectsService.updateProspect(newRow.documentId, {
                firstName: newRow.firstName,
                lastName: newRow.lastName,
                phone: newRow.phone,
                trainingGoal: newRow.trainingGoal
              })
              setProspects(prospects.map(p => p.id === newRow.id ? newRow : p))
              toast.success('Prospect actualizado')
              return newRow
            } catch (error) {
              console.error('Error updating prospect:', error)
              toast.error('Error al actualizar prospect')
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

      {/* Prospect Detail Side Panel */}
      {showSidePanel && selectedProspect && (
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
                Detalles del Prospect
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
                  <p className="text-lg font-medium text-gray-900">{selectedProspect.email}</p>
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

                <div>
                  <label className="form-label">Objetivo de entrenamiento</label>
                  <select
                    className="form-input"
                    value={editFormData.trainingGoal}
                    onChange={(e) => handleFormChange('trainingGoal', e.target.value)}
                  >
                    <option value="">Sin especificar</option>
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
                    className="form-input"
                    rows="3"
                    value={editFormData.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                  />
                </div>

                {/* Read-only info */}
                <div className="border-t border-[#edeaea] pt-4">
                  <label className="text-sm font-medium text-gray-500">Fuente</label>
                  <p className="text-gray-900">{selectedProspect.source || 'website'}</p>
                </div>

                <div className="border-t border-[#edeaea] pt-4">
                  <label className="text-sm font-medium text-gray-500">Estado</label>
                  {selectedProspect.convertedToLead ? (
                    <p className="text-green-600 font-medium">✓ Convertido a Lead</p>
                  ) : (
                    <p className="text-yellow-600 font-medium">⏳ Pendiente de conversión</p>
                  )}
                </div>

                <div className="border-t border-[#edeaea] pt-4">
                  <label className="text-sm font-medium text-gray-500">Fecha de captura</label>
                  <p className="text-gray-900">
                    {new Date(selectedProspect.capturedAt).toLocaleString('es-AR')}
                  </p>
                </div>

                {selectedProspect.lastInteraction && (
                  <div className="border-t border-[#edeaea] pt-4">
                    <label className="text-sm font-medium text-gray-500">Última interacción</label>
                    <p className="text-gray-900">
                      {new Date(selectedProspect.lastInteraction).toLocaleString('es-AR')}
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
              {!selectedProspect.convertedToLead && (
                <button
                  onClick={() => {
                    setShowSidePanel(false)
                    handleOpenConvertModal(selectedProspect)
                  }}
                  className="btn-primary w-full flex items-center justify-center"
                >
                  <ArrowRightIcon className="h-5 w-5 mr-2" />
                  Convertir a Lead
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

      {/* Convert to Lead Side Panel */}
      {showConvertModal && prospectToConvert && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-white/70 backdrop-blur-sm z-[60] animate-[fadeIn_0.3s_ease-in-out]"
            onClick={() => setShowConvertModal(false)}
          />
          
          {/* Side Panel */}
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[60] overflow-y-auto animate-[slideInRight_0.3s_ease-out]">
            <div className="p-6">
              {/* Header with Close Button */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Convertir a Lead
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
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 mb-4">
              <label className="text-xs font-medium text-sky-700 uppercase tracking-wide">Email</label>
              <p className="text-lg font-semibold text-sky-900 mt-1">{prospectToConvert.email}</p>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Completa los datos faltantes para convertir este prospect en lead
            </p>
            <div className="space-y-3">
              <div>
                <label className="form-label">Nombre *</label>
                <input
                  type="text"
                  className="form-input"
                  value={convertFormData.firstName}
                  onChange={(e) => setConvertFormData({...convertFormData, firstName: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="form-label">Apellido *</label>
                <input
                  type="text"
                  className="form-input"
                  value={convertFormData.lastName}
                  onChange={(e) => setConvertFormData({...convertFormData, lastName: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="form-label">Teléfono *</label>
                <input
                  type="tel"
                  className="form-input"
                  value={convertFormData.phone}
                  onChange={(e) => setConvertFormData({...convertFormData, phone: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="form-label">Objetivo de entrenamiento *</label>
                <select
                  className="form-input"
                  value={convertFormData.trainingGoal}
                  onChange={(e) => setConvertFormData({...convertFormData, trainingGoal: e.target.value})}
                  required
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
                <label className="form-label">Asignar vendedor</label>
                <select
                  className="form-input"
                  value={convertFormData.seller || ''}
                  onChange={(e) => setConvertFormData({...convertFormData, seller: e.target.value || null})}
                >
                  <option value="">Sin vendedor</option>
                  {sellers.map(seller => (
                    <option key={seller.id} value={seller.id}>
                      {seller.firstName} {seller.lastName}
                    </option>
                  ))}
                </select>
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
                onClick={handleConvertToLead}
                className="btn-primary"
                disabled={!convertFormData.firstName || !convertFormData.lastName || !convertFormData.phone || !convertFormData.trainingGoal}
              >
                Convertir a Lead
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

export default Prospects

