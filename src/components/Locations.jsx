import { useState, useEffect } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { locationsService } from '../services/locationsService'
import toast from 'react-hot-toast'
import Modal from './Modal'

const Locations = () => {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLocation, setEditingLocation] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: ''
  })

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
      if (editingLocation) {
        await locationsService.updateLocation(editingLocation.id, formData)
        toast.success('Sede actualizada')
      } else {
        await locationsService.createLocation(formData)
        toast.success('Sede creada')
      }

      await fetchLocations()
      handleCloseModal()
    } catch (error) {
      toast.error('Error al guardar sede')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta sede?')) return

    try {
      await locationsService.deleteLocation(id)
      toast.success('Sede eliminada')
      await fetchLocations()
    } catch (error) {
      toast.error('Error al eliminar sede')
    }
  }

  const openEditModal = (location) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      address: location.address || '',
      phone: location.phone || ''
    })
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingLocation(null)
    setFormData({
      name: '',
      address: '',
      phone: ''
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
          onClick={() => setShowModal(true)}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Nueva Sede
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => (
          <div key={location.id} className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow">
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

              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {location.name}
              </h3>
              
              <div className="space-y-2 text-sm text-gray-500">
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
            </div>
          </div>
        ))}
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
        </form>
      </Modal>
    </div>
  )
}

export default Locations
