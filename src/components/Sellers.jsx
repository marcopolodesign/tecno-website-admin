import { useState, useEffect } from 'react'
import { supabase, isServiceRole } from '../lib/supabase'
import { locationsService } from '../services/locationsService'
import logsService from '../services/logsService'
import { getCurrentUserForLogging } from '../utils/logHelpers'
import { PlusIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

const Sellers = () => {
  const [sellers, setSellers] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSeller, setEditingSeller] = useState(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'front_desk',
    active: true,
    location_id: ''
  })

  useEffect(() => {
    fetchSellers()
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

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from('sellers')
        .select(`
          *,
          locations(name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSellers(data || [])
    } catch (error) {
      console.error('Error fetching sellers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const sellerData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        active: formData.active,
        location_id: formData.location_id || null
      }

      if (editingSeller) {
        // Update existing seller
        const { error } = await supabase
          .from('sellers')
          .update(sellerData)
          .eq('id', editingSeller.id)

        if (error) throw error

        // Update password if provided
        if (formData.password && editingSeller.auth_user_id) {
          const { error: authError } = await supabase.auth.admin.updateUserById(
            editingSeller.auth_user_id,
            { password: formData.password }
          )
          if (authError) console.error('Error updating password:', authError)
        }
      } else {
        // Create new seller with auth user using admin API
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

        // Create seller record
        const { data: newSeller, error: sellerError } = await supabase
          .from('sellers')
          .insert([{
            auth_user_id: authData.user.id,
            ...sellerData
          }])
          .select()
          .single()

        if (sellerError) throw sellerError

        // Log seller creation
        try {
          const performedBy = await getCurrentUserForLogging()
          const sellerName = `${formData.first_name} ${formData.last_name}`.trim()

          await logsService.logSellerCreated(
            newSeller.id,
            sellerName,
            {
              email: formData.email,
              role: formData.role,
              phone: formData.phone
            },
            performedBy
          )
        } catch (logError) {
          console.error('Error logging seller creation:', logError)
          // Don't fail the operation if logging fails
        }
      }

      await fetchSellers()
      setShowModal(false)
      resetForm()
    } catch (error) {
      console.error('Error saving seller:', error)
      alert('Error al guardar vendedor: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (seller) => {
    if (!confirm('¿Estás seguro de eliminar este vendedor?')) return

    try {
      // Delete auth user (will cascade to seller)
      if (seller.auth_user_id) {
        const { error: authError } = await supabase.auth.admin.deleteUser(
          seller.auth_user_id
        )
        if (authError) console.error('Error deleting auth user:', authError)
      }

      // Delete seller record
      const { error } = await supabase
        .from('sellers')
        .delete()
        .eq('id', seller.id)

      if (error) throw error

      await fetchSellers()
    } catch (error) {
      console.error('Error deleting seller:', error)
      alert('Error al eliminar vendedor: ' + error.message)
    }
  }

  const openEditModal = (seller) => {
    setEditingSeller(seller)
    setFormData({
      first_name: seller.first_name,
      last_name: seller.last_name,
      email: seller.email,
      phone: seller.phone || '',
      password: '',
      role: seller.role,
      active: seller.active,
      location_id: seller.location_id || ''
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
      role: 'front_desk',
      active: true,
      location_id: ''
    })
    setEditingSeller(null)
  }

  const getRoleBadge = (role) => {
    const badges = {
      super_admin: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      front_desk: 'bg-green-100 text-green-800'
    }
    const labels = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      front_desk: 'Front Desk'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badges[role]}`}>
        {labels[role]}
      </span>
    )
  }

  if (loading && sellers.length === 0) {
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
                Advertencia: No se detectó la clave de servicio (Service Role Key). No podrás crear nuevos vendedores.
                <br />
                Asegúrate de configurar <code className="font-mono font-bold">VITE_SUPABASE_SERVICE_ROLE_KEY</code> en tu archivo .env (local) o en Vercel.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendedores</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona el equipo de ventas y front desk
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
          Nuevo Vendedor
        </button>
      </div>

      {/* Sellers Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teléfono
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sede
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sellers.map((seller) => (
              <tr key={seller.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="shrink-0 h-10 w-10 bg-sky-100 rounded-full flex items-center justify-center">
                      <span className="text-sky-600 font-medium">
                        {seller.first_name?.charAt(0)}{seller.last_name?.charAt(0)}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {seller.first_name} {seller.last_name}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {seller.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {seller.phone || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {seller.locations?.name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getRoleBadge(seller.role)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    seller.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {seller.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => openEditModal(seller)}
                    className="text-sky-600 hover:text-sky-900 mr-4"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(seller)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingSeller ? 'Editar Vendedor' : 'Nuevo Vendedor'}
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
                        disabled={!!editingSeller}
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
                      <label className="block text-sm font-medium text-gray-700">Sede</label>
                      <select
                        value={formData.location_id}
                        onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 bg-white"
                      >
                        <option value="">Seleccionar Sede</option>
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Contraseña {editingSeller && '(dejar vacío para no cambiar)'}
                      </label>
                      <input
                        type="password"
                        required={!editingSeller}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                        minLength={6}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Rol</label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                      >
                        <option value="front_desk">Front Desk</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
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

export default Sellers

