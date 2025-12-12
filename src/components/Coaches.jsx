import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'

const Coaches = () => {
  const [coaches, setCoaches] = useState([])
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
    hire_date: ''
  })

  useEffect(() => {
    fetchCoaches()
  }, [])

  const fetchCoaches = async () => {
    try {
      const { data, error } = await supabase
        .from('coaches')
        .select('*')
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

      if (editingCoach) {
        // Update existing coach
        const { error } = await supabase
          .from('coaches')
          .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone,
            specialization: formData.specialization,
            certifications: certificationsArray,
            bio: formData.bio,
            is_active: formData.is_active,
            hire_date: formData.hire_date || null
          })
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
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone,
            specialization: formData.specialization,
            certifications: certificationsArray,
            bio: formData.bio,
            is_active: formData.is_active,
            hire_date: formData.hire_date || null
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
      hire_date: coach.hire_date || ''
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
      hire_date: ''
    })
    setEditingCoach(null)
  }

  if (loading && coaches.length === 0) {
    return <div className="p-6">Cargando...</div>
  }

  return (
    <div className="p-6">
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
      {showModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[80vh] overflow-y-auto">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingCoach ? 'Editar Coach' : 'Nuevo Coach'}
                  </h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre</label>
                        <input
                          type="text"
                          required
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Apellido</label>
                        <input
                          type="text"
                          required
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email</label>
                      <input
                        type="email"
                        required
                        disabled={!!editingCoach}
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 disabled:bg-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Contraseña {editingCoach && '(dejar vacío para no cambiar)'}
                      </label>
                      <input
                        type="password"
                        required={!editingCoach}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                        minLength={6}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Especialización</label>
                      <input
                        type="text"
                        value={formData.specialization}
                        onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                        placeholder="ej: Strength & Conditioning, Functional Training"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Certificaciones (separadas por coma)
                      </label>
                      <input
                        type="text"
                        value={formData.certifications}
                        onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
                        placeholder="ej: NSCA-CPT, CrossFit Level 1"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Biografía</label>
                      <textarea
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Fecha de contratación</label>
                      <input
                        type="date"
                        value={formData.hire_date}
                        onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                      />
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-900">
                        Activo
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-sky-600 text-base font-medium text-white hover:bg-sky-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {loading ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      resetForm()
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Coaches

