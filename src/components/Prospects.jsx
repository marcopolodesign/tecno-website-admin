import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { 
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowRightIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { DataGrid } from '@mui/x-data-grid'
import { prospectsService } from '../services/prospectsService'
import { sellersService } from '../services/sellersService'
import { dataGridStyles, toastOptions } from '../lib/themeStyles'

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
      fetchProspects()
      toast.success('¡Prospect convertido a Lead exitosamente!')
    } catch (error) {
      console.error('Error converting prospect:', error)
      toast.error('Error al convertir prospect. Verifica que los datos estén completos.')
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
        await prospectsService.deleteProspect(prospect.id)
        setProspects(prospects.filter(p => p.id !== prospect.id))
        toast.success('Prospect eliminado exitosamente')
      } catch (error) {
        console.error('Error deleting prospect:', error)
        toast.error('Error al eliminar prospect')
      }
    }
  }

  const handleFormChange = (field, value) => {
    const newFormData = { ...editFormData, [field]: value }
    setEditFormData(newFormData)
    
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
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Prospects</h1>
          <p className="text-sm text-text-secondary mt-1">Usuarios que mostraron interés pero no completaron el formulario</p>
        </div>
        <button
          onClick={handleExport}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Exportar CSV
        </button>
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
            <label className="form-label">Filtrar por conversión</label>
            <select
              className="form-select"
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
      <div className="card p-0 overflow-hidden" style={{ height: 600 }}>
        <DataGrid
          rows={filteredProspects}
          columns={[
            {
              field: 'fullName',
              headerName: 'Prospect',
              width: 200,
              valueGetter: (value, row) => `${row.firstName || 'Sin nombre'} ${row.lastName || ''}`,
              renderCell: (params) => (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-purple-500/10 rounded-full flex items-center justify-center">
                    <span className="text-purple-400 font-medium text-sm">
                      {params.row.firstName?.charAt(0) || params.row.email.charAt(0).toUpperCase()}
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
            },
            {
              field: 'phone',
              headerName: 'Teléfono',
              width: 150,
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
                <span className={`status-badge ${params.value ? 'status-convertido' : 'status-contactado'}`}>
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
                <div className="flex gap-2">
                  {!params.row.convertedToLead && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenConvertModal(params.row)
                      }}
                      className="p-1.5 text-brand hover:bg-brand/10 rounded transition-colors"
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
          sx={dataGridStyles}
        />
      </div>

      {/* Prospect Detail Side Panel */}
      {showSidePanel && selectedProspect && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 z-40 animate-fade-in"
            onClick={() => setShowSidePanel(false)}
          />
          
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-bg-secondary border-l border-border-default z-50 flex flex-col animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border-default">
              <h3 className="text-lg font-semibold text-text-primary">
                Detalles del Prospect
              </h3>
              <button
                onClick={() => setShowSidePanel(false)}
                className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-surface rounded transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Email</label>
                  <p className="text-sm font-medium text-text-primary mt-1">{selectedProspect.email}</p>
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

                <div>
                  <label className="form-label">Objetivo de entrenamiento</label>
                  <select
                    className="form-select"
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
                    className="form-textarea"
                    rows="3"
                    value={editFormData.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                  />
                </div>

                <div className="border-t border-border-default pt-4">
                  <label className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Estado</label>
                  {selectedProspect.convertedToLead ? (
                    <p className="text-sm text-brand mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 bg-brand rounded-full" />
                      Convertido a Lead
                    </p>
                  ) : (
                    <p className="text-sm text-warning mt-1 flex items-center gap-1">
                      <span className="w-2 h-2 bg-warning rounded-full" />
                      Pendiente de conversión
                    </p>
                  )}
                </div>

                <div className="border-t border-border-default pt-4">
                  <label className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Fecha de captura</label>
                  <p className="text-sm text-text-primary mt-1">
                    {new Date(selectedProspect.capturedAt).toLocaleString('es-AR')}
                  </p>
                </div>

                {/* UTM Parameters */}
                {(selectedProspect.utmSource || selectedProspect.utmMedium || selectedProspect.utmCampaign) && (
                  <div className="border-t border-border-default pt-4">
                    <label className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2 block">Parámetros UTM</label>
                    <div className="bg-bg-surface rounded-lg p-3 space-y-2 text-sm border border-border-default">
                      {selectedProspect.utmSource && (
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Source:</span>
                          <span className="text-text-primary">{selectedProspect.utmSource}</span>
                        </div>
                      )}
                      {selectedProspect.utmMedium && (
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Medium:</span>
                          <span className="text-text-primary">{selectedProspect.utmMedium}</span>
                        </div>
                      )}
                      {selectedProspect.utmCampaign && (
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Campaign:</span>
                          <span className="text-text-primary">{selectedProspect.utmCampaign}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t border-border-default p-5 space-y-3">
              {hasChanges && (
                <button
                  onClick={handleSaveEdit}
                  className="btn-primary w-full"
                >
                  Guardar cambios
                </button>
              )}
              {!selectedProspect.convertedToLead && (
                <button
                  onClick={() => {
                    setShowSidePanel(false)
                    handleOpenConvertModal(selectedProspect)
                  }}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <ArrowRightIcon className="h-4 w-4" />
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

      {/* Convert to Lead Modal */}
      {showConvertModal && prospectToConvert && (
        <>
          <div 
            className="fixed inset-0 bg-bg-overlay z-[60] animate-fade-in"
            onClick={() => setShowConvertModal(false)}
          />
          
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-bg-secondary border-l border-border-default z-[60] flex flex-col animate-slide-in-right">
            <div className="p-5 border-b border-border-default">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">
                  Convertir a Lead
                </h3>
                <button
                  onClick={() => setShowConvertModal(false)}
                  className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-surface rounded transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="bg-brand/10 border border-brand/20 rounded-lg p-3 mb-5">
                <label className="text-xs font-medium text-brand uppercase tracking-wide">Email</label>
                <p className="text-sm font-medium text-text-primary mt-1">{prospectToConvert.email}</p>
              </div>
              
              <p className="text-sm text-text-secondary mb-5">
                Completa los datos faltantes para convertir este prospect en lead
              </p>

              <div className="space-y-4">
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
                    className="form-select"
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
                    className="form-select"
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
            </div>

            <div className="border-t border-border-default p-5 flex gap-3">
              <button
                onClick={() => setShowConvertModal(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleConvertToLead}
                className="btn-primary flex-1"
                disabled={!convertFormData.firstName || !convertFormData.lastName || !convertFormData.phone || !convertFormData.trainingGoal}
              >
                Convertir a Lead
              </button>
            </div>
          </div>
        </>
      )}

      <Toaster position="top-right" toastOptions={toastOptions} />
    </div>
  )
}

export default Prospects
