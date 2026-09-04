import { useState, useEffect } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, MapPinIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { locationsService } from '../services/locationsService'
import { useSede } from '../contexts/SedeContext'
import toast from 'react-hot-toast'
import Modal from './Modal'

const Locations = () => {
  // El selector global vive en SedeContext — esta pantalla sólo lo usa para marcar cuál sede
  // está activa (setSedeId) y para no mostrar como "activa" una que ya no existe.
  const { sedeId, setSedeId, refetchSedes } = useSede()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLocation, setEditingLocation] = useState(null)
  const [sincronizando, setSincronizando] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    is_active: true,
    sync_from_location_id: '',
    sync_enabled: false
  })
  // Sólo tiene sentido al CREAR — copiar es el punto de partida, no algo que se repite cada vez
  // que se edita una sede que ya existe. El sync continuo (formData.sync_enabled) es aparte.
  const [copiarDe, setCopiarDe] = useState('')

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const { data } = await locationsService.getLocations()
      setLocations(data || [])
    } catch (error) {
      toast.error('Error al cargar sedes')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = { ...formData, sync_from_location_id: formData.sync_from_location_id || null }

      if (editingLocation) {
        await locationsService.updateLocation(editingLocation.id, payload)
        toast.success('Sede actualizada')
      } else {
        const { data: nueva } = await locationsService.createLocation(payload)
        toast.success('Sede creada')

        if (copiarDe && nueva?.id) {
          try {
            const { data: resultado } = await locationsService.copiarEquipamiento(copiarDe, nueva.id)
            toast.success(
              `Equipamiento copiado: ${resultado?.lineas_creadas ?? 0} líneas, ${resultado?.boxes_creados ?? 0} boxes`
            )
          } catch (copyError) {
            // La sede ya quedó creada — no copiar el equipamiento no es motivo para perderla.
            // Se puede reintentar desde acá mismo (botón "Sincronizar ahora" una vez guardada).
            toast.error('La sede se creó, pero copiar el equipamiento falló — probá "Sincronizar ahora" desde su tarjeta.')
          }
        }
      }

      await fetchLocations()
      await refetchSedes()
      handleCloseModal()
    } catch (error) {
      toast.error('Error al guardar sede')
    } finally {
      setLoading(false)
    }
  }

  const sincronizarAhora = async (location) => {
    if (!location.sync_from_location_id) return
    setSincronizando(location.id)
    try {
      const { data: resultado } = await locationsService.copiarEquipamiento(location.sync_from_location_id, location.id)
      toast.success(
        `Sincronizado: ${resultado?.lineas_creadas ?? 0} líneas nuevas, ${resultado?.boxes_creados ?? 0} boxes nuevos, ${resultado?.boxes_actualizados ?? 0} actualizados`
      )
    } catch (error) {
      toast.error('Error al sincronizar')
    } finally {
      setSincronizando(null)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta sede?')) return

    try {
      await locationsService.deleteLocation(id)
      toast.success('Sede eliminada')
      await fetchLocations()
      await refetchSedes()
    } catch (error) {
      toast.error('Error al eliminar sede')
    }
  }

  const openEditModal = (location) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      address: location.address || '',
      city: location.city || '',
      country: location.country || '',
      phone: location.phone || '',
      is_active: location.is_active ?? true,
      sync_from_location_id: location.sync_from_location_id || '',
      sync_enabled: location.sync_enabled ?? false
    })
    setShowModal(true)
  }

  const openNewModal = () => {
    setCopiarDe('')
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingLocation(null)
    setCopiarDe('')
    setFormData({
      name: '',
      address: '',
      city: '',
      country: '',
      phone: '',
      is_active: true,
      sync_from_location_id: '',
      sync_enabled: false
    })
  }

  if (loading && locations.length === 0) {
    return <div className="p-6">Cargando...</div>
  }

  return (
    <div className="p-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sedes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona las ubicaciones del gimnasio
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Nueva Sede
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => {
          const esActiva = location.id === sedeId
          return (
            <div
              key={location.id}
              className={`bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow ${
                esActiva ? 'ring-2 ring-sky-500' : ''
              }`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="shrink-0 h-12 w-12 bg-sky-100 rounded-full flex items-center justify-center">
                    <MapPinIcon className="h-6 w-6 text-sky-600" />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openEditModal(location)}
                      className="text-sky-600 hover:text-sky-900"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(location.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-medium text-gray-900">{location.name}</h3>
                  {!location.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactiva</span>
                  )}
                </div>

                <div className="space-y-2 text-sm text-gray-500 mb-4">
                  {(location.city || location.country) && (
                    <p className="flex items-start">
                      <span className="font-medium mr-2">Ciudad:</span>
                      {[location.city, location.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {location.address && (
                    <p className="flex items-start">
                      <span className="font-medium mr-2">Dirección:</span>
                      {location.address}
                    </p>
                  )}
                  {location.phone && (
                    <p className="flex items-center">
                      <span className="font-medium mr-2">Teléfono:</span>
                      {location.phone}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  {esActiva ? (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-sky-600">
                      <CheckCircleIcon className="h-4 w-4" />
                      Sede activa
                    </div>
                  ) : (
                    <button
                      onClick={() => setSedeId(location.id)}
                      className="text-sm font-medium text-sky-600 hover:text-sky-800"
                    >
                      Elegir como sede activa
                    </button>
                  )}

                  {location.sync_enabled && location.sync_from_location_id && (
                    <button
                      onClick={() => sincronizarAhora(location)}
                      disabled={sincronizando === location.id}
                      title={`Sincroniza con ${locations.find((l) => l.id === location.sync_from_location_id)?.name || 'otra sede'}`}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-sky-600 disabled:opacity-50"
                    >
                      <ArrowPathIcon className={`h-3.5 w-3.5 ${sincronizando === location.id ? 'animate-spin' : ''}`} />
                      Sincronizar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingLocation ? 'Editar Sede' : 'Nueva Sede'}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCloseModal}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Nombre *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
              placeholder="Ej: Sede Palermo"
            />
          </div>

          <div>
            <label className="form-label">Dirección</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="form-input"
              placeholder="Ej: Av. Santa Fe 1234"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Ciudad</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="form-input"
                placeholder="Buenos Aires"
              />
            </div>
            <div>
              <label className="form-label">País</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="form-input"
                placeholder="Argentina"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Teléfono</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="form-input"
              placeholder="+54 9 11 ..."
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
            />
            Sede activa (aparece en el selector)
          </label>

          {!editingLocation && locations.length > 0 && (
            <div className="pt-2 border-t border-border-default">
              <label className="form-label">Copiar equipamiento de</label>
              <select
                value={copiarDe}
                onChange={(e) => setCopiarDe(e.target.value)}
                className="form-select"
              >
                <option value="">No copiar — arrancar vacía</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-text-tertiary mt-1">
                Trae las mismas líneas, boxes y materiales como punto de partida — se pueden
                editar después desde Equipamiento, igual que cualquier sede.
              </p>
            </div>
          )}

          {locations.length > 0 && (
            <div className="pt-2 border-t border-border-default">
              <label className="flex items-center gap-2 text-sm text-text-secondary mb-2">
                <input
                  type="checkbox"
                  checked={formData.sync_enabled}
                  onChange={(e) => setFormData({ ...formData, sync_enabled: e.target.checked })}
                />
                Mantener sincronizado el equipamiento con otra sede
              </label>
              {formData.sync_enabled && (
                <>
                  <select
                    value={formData.sync_from_location_id}
                    onChange={(e) => setFormData({ ...formData, sync_from_location_id: e.target.value })}
                    className="form-select"
                  >
                    <option value="">Elegir sede de origen...</option>
                    {locations
                      .filter((l) => l.id !== editingLocation?.id)
                      .map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                  </select>
                  <p className="text-[11px] text-text-tertiary mt-1">
                    Cada 15 minutos se copian las líneas, boxes y materiales nuevos o cambiados
                    de esa sede acá — nunca borra un box que ya existe en esta sede.
                  </p>
                </>
              )}
            </div>
          )}
        </form>
      </Modal>
    </div>
  )
}

export default Locations






