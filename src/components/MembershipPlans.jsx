import { useState, useEffect } from 'react'
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import membershipPlansService from '../services/membershipPlansService'
import toast from 'react-hot-toast'

export default function MembershipPlans() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const { data } = await membershipPlansService.getPlans()
      setPlans(data)
    } catch (error) {
      console.error('Error fetching plans:', error)
      toast.error('Error al cargar planes de membresía')
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (plan) => {
    setEditingId(plan.id)
    setEditForm({
      price: plan.price,
      description: plan.description,
      isActive: plan.isActive
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = async (planId) => {
    try {
      await membershipPlansService.updatePlan(planId, editForm)
      toast.success('Plan actualizado correctamente')
      setEditingId(null)
      setEditForm({})
      fetchPlans()
    } catch (error) {
      console.error('Error updating plan:', error)
      toast.error('Error al actualizar el plan')
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Planes de Membresía</h1>
        <p className="mt-2 text-sm text-gray-600">
          Administra los precios y configuración de los planes de membresía
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duración
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Precio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descripción
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
            {plans.map((plan) => (
              <tr key={plan.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 capitalize">
                    {plan.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {plan.durationMonths} {plan.durationMonths === 1 ? 'mes' : 'meses'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === plan.id ? (
                    <input
                      type="number"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      className="form-input w-32"
                      step="0.01"
                    />
                  ) : (
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(plan.price)}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === plan.id ? (
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="form-input w-full"
                    />
                  ) : (
                    <div className="text-sm text-gray-600">
                      {plan.description}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === plan.id ? (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Activo</span>
                    </label>
                  ) : (
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      plan.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {plan.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {editingId === plan.id ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => saveEdit(plan.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-red-600 hover:text-red-900"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(plan)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">💡 Información</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Los precios se muestran en pesos argentinos (ARS)</li>
          <li>• Los planes inactivos no aparecerán al crear nuevas membresías</li>
          <li>• La duración no se puede modificar (es fija por tipo de plan)</li>
          <li>• Los cambios de precio solo afectan a nuevas membresías</li>
        </ul>
      </div>
    </div>
  )
}

