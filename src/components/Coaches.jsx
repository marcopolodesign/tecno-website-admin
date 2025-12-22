import { useState, useEffect } from 'react'
import { supabase, isServiceRole } from '../lib/supabase'
import { locationsService } from '../services/locationsService'
import { PlusIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import Modal from './Modal'

const Coaches = () => {
  const [coaches, setCoaches] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCoach, setEditingCoach] = useState(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    specialization: '',
    certifications: '',
    bio: '',
    is_active: true,
    hire_date: '',
    location_id: '',
    age: ''
  })

  useEffect(() => {
    fetchCoaches()
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const { data } = await locationsService.getLocations()
      setLocations(data || [])
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchCoaches = async () => {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select(`
          *,
          users(count),
          locations(name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCoaches(data || [])
    } catch (error) {
      console.error('Error fetching coaches:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Parse certifications from comma-separated string to array
      const certificationsArray = formData.certifications
        ? formData.certifications.split(',').map(cert => cert.trim()).filter(cert => cert)
        : []

      const coachData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        specialization: formData.specialization,
        certifications: certificationsArray,
        bio: formData.bio,
        is_active: formData.is_active,
        hire_date: formData.hire_date || null,
        location_id: formData.location_id || null,
        age: formData.age || null
      }

      if (editingCoach) {
        // Update existing coach
        const { error } = await supabase
          .from('coaches')
          .update(coachData)
          .eq('id', editingCoach.id)

        if (error) throw error

        // Update password if provided
        if (formData.password && editingCoach.auth_user_id) {
          const { error: authError } = await supabase.auth.admin.updateUserById(
            editingCoach.auth_user_id,
            { password: formData.password }
          )
          if (authError) console.error('Error updating password:', authError)
        }
      } else {
        // Create new coach with auth user using admin API
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            first_name: formData.first_name,
            last_name: formData.last_name
          }
        })

        if (authError) throw authError

        // Create coach record
        const { error: coachError } = await supabase
          .from('coaches')
          .insert([{
            auth_user_id: authData.user.id,
            ...coachData
          }])

        if (coachError) throw coachError
      }

      await fetchCoaches()
      setShowModal(false)
      resetForm()
    } catch (error) {
      console.error('Error saving coach:', error)
      alert('Error al guardar coach: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (coach) => {
    if (!confirm('¿Estás seguro de eliminar este coach?')) return

    try {
      // Delete auth user (will cascade to coach)
      if (coach.auth_user_id) {
        const { error: authError } = await supabase.auth.admin.deleteUser(
          coach.auth_user_id
        )
        if (authError) console.error('Error deleting auth user:', authError)
      }

      // Delete coach record
      const { error } = await supabase
        .from('coaches')
        .delete()
        .eq('id', coach.id)

      if (error) throw error

      await fetchCoaches()
    } catch (error) {
      console.error('Error deleting coach:', error)
      alert('Error al eliminar coach: ' + error.message)
    }
  }

  const openEditModal = (coach) => {
    setEditingCoach(coach)
    setFormData({
      first_name: coach.first_name,
      last_name: coach.last_name,
      email: coach.email,
      phone: coach.phone || '',
      password: '',
      specialization: coach.specialization || '',
      certifications: coach.certifications ? coach.certifications.join(', ') : '',
      bio: coach.bio || '',
      is_active: coach.is_active,
      hire_date: coach.hire_date || '',
      location_id: coach.location_id || '',
      age: coach.age || ''
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      password: '',
      specialization: '',
      certifications: '',
      bio: '',
      is_active: true,
      hire_date: '',
      location_id: '',
      age: ''
    })
    setEditingCoach(null)
  }

  if (loading && coaches.length === 0) {
    return <div className="p-6">Cargando...</div>
  }

  return (
    <div className="p-6">
      {!isServiceRole && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Advertencia: No se detectó la clave de servicio (Service Role Key). No podrás crear nuevos coaches.
                <br />
                Asegúrate de configurar <code className="font-mono font-bold">VITE_SUPABASE_SERVICE_ROLE_KEY</code> en tu archivo .env (local) o en Vercel.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coaches</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona el equipo de entrenadores
          </p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowModal(true)
          }}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Nuevo Coach
        </button>
      </div>

      {/* Coaches Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {coaches.map((coach) => (
          <div key={coach.id} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="shrink-0 h-16 w-16 bg-sky-100 rounded-full flex items-center justify-center">
                  <span className="text-sky-600 font-bold text-xl">
                    {coach.first_name?.charAt(0)}{coach.last_name?.charAt(0)}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => openEditModal(coach)}
                    className="text-sky-600 hover:text-sky-900"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(coach)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-medium text-gray-900">
                {coach.first_name} {coach.last_name}
              </h3>
              
              {coach.specialization && (
                <p className="mt-1 text-sm text-sky-600 font-medium">
                  {coach.specialization}
                </p>
              )}

              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-500">{coach.email}</p>
                {coach.phone && (
                  <p className="text-sm text-gray-500">{coach.phone}</p>
                )}
                <div className="flex gap-4 text-sm text-gray-600">
                  {(coach.locations?.name || coach.location) && (
                    <span className="flex items-center">
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {coach.locations?.name || coach.location}
                    </span>
                  )}
                  {coach.age && (
                    <span>{coach.age} años</span>
                  )}
                </div>
                <div className="text-sm font-medium text-sky-700">
                  {coach.users && coach.users[0] ? `${coach.users[0].count} Usuarios asignados` : '0 Usuarios asignados'}
                </div>
              </div>

              {coach.certifications && coach.certifications.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Certificaciones:</p>
                  <div className="flex flex-wrap gap-1">
                    {coach.certifications.map((cert, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {coach.bio && (
                <p className="mt-4 text-sm text-gray-600 line-clamp-2">
                  {coach.bio}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  coach.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {coach.is_active ? 'Activo' : 'Inactivo'}
                </span>
                {coach.hire_date && (
                  <span className="text-xs text-gray-500">
                    Desde {new Date(coach.hire_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          resetForm()
        }}
        title={editingCoach ? 'Editar Coach' : 'Nuevo Coach'}
        size="2xl"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowModal(false)
                resetForm()
              }}
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
          {/* Personal Info */}
          <div className="border-b border-border-default pb-4">
            <h4 className="font-semibold text-text-primary mb-3">Información Personal</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Nombre *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Apellido *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  required
                  disabled={!!editingCoach}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="form-input disabled:bg-bg-surface disabled:text-text-tertiary"
                />
                {editingCoach && (
                  <p className="text-xs text-text-tertiary mt-1">El email no se puede cambiar</p>
                )}
              </div>
              <div>
                <label className="form-label">Teléfono</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="form-label">Sede</label>
                <select
                  value={formData.location_id}
                  onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                  className="form-select"
                >
                  <option value="">Seleccionar Sede</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Edad</label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="form-input"
                  placeholder="Opcional"
                />
              </div>
            </div>
          </div>

          {/* Credentials */}
          <div className="border-b border-border-default pb-4">
            <h4 className="font-semibold text-text-primary mb-3">Acceso</h4>
            <div>
              <label className="form-label">
                Contraseña {editingCoach ? '(dejar vacío para no cambiar)' : '*'}
              </label>
              <input
                type="password"
                required={!editingCoach}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="form-input"
                minLength={6}
              />
            </div>
          </div>

          {/* Professional Info */}
          <div className="border-b border-border-default pb-4">
            <h4 className="font-semibold text-text-primary mb-3">Información Profesional</h4>
            <div>
              <label className="form-label">Especialización</label>
              <input
                type="text"
                value={formData.specialization}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                placeholder="ej: Strength & Conditioning, Functional Training"
                className="form-input"
              />
            </div>

            <div className="mt-4">
              <label className="form-label">Certificaciones (separadas por coma)</label>
              <input
                type="text"
                value={formData.certifications}
                onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
                placeholder="ej: NSCA-CPT, CrossFit Level 1"
                className="form-input"
              />
            </div>

            <div className="mt-4">
              <label className="form-label">Biografía</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="form-textarea"
                placeholder="Breve descripción profesional..."
              />
            </div>

            <div className="mt-4">
              <label className="form-label">Fecha de contratación</label>
              <input
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                className="form-input"
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="coachActive"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-brand rounded border-border-default focus:ring-brand"
            />
            <label htmlFor="coachActive" className="text-sm text-text-secondary">
              Activo
            </label>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Coaches

