import { useState, useEffect } from 'react'
import { PencilIcon, CheckIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline'
import membershipPlansService from '../services/membershipPlansService'
import toast, { Toaster } from 'react-hot-toast'
import { toastOptions } from '../lib/themeStyles'

export default function MembershipPlans({ userRole }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    durationMonths: 1,
    price: '',
    priceEfectivo: '',
    priceDebitoAutomatico: '',
    priceTarjetaTransferencia: '',
    description: '',
    isActive: true
  })
  const [creating, setCreating] = useState(false)

  const isSuperAdmin = userRole === 'super_admin'

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      // Super admins see all plans including inactive ones
      const { data } = await membershipPlansService.getPlans(isSuperAdmin)
      setPlans(data)
    } catch (error) {
      console.error('Error fetching plans:', error)
      toast.error('Error al cargar planes de membresía', toastOptions)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (plan) => {
    setEditingId(plan.id)
    setEditForm({
      price: plan.price,
      priceEfectivo: plan.priceEfectivo || plan.price,
      priceDebitoAutomatico: plan.priceDebitoAutomatico || plan.price,
      priceTarjetaTransferencia: plan.priceTarjetaTransferencia || plan.price,
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
      toast.success('Plan actualizado correctamente', toastOptions)
      setEditingId(null)
      setEditForm({})
      fetchPlans()
    } catch (error) {
      console.error('Error updating plan:', error)
      toast.error('Error al actualizar el plan', toastOptions)
    }
  }

  const handleCreatePlan = async (e) => {
    e.preventDefault()
    
    if (!createForm.name || !createForm.price) {
      toast.error('Nombre y precio son requeridos', toastOptions)
      return
    }

    try {
      setCreating(true)
      await membershipPlansService.createPlan({
        ...createForm,
        price: parseFloat(createForm.price),
        priceEfectivo: parseFloat(createForm.priceEfectivo) || parseFloat(createForm.price),
        priceDebitoAutomatico: parseFloat(createForm.priceDebitoAutomatico) || parseFloat(createForm.price),
        priceTarjetaTransferencia: parseFloat(createForm.priceTarjetaTransferencia) || parseFloat(createForm.price),
        durationMonths: parseInt(createForm.durationMonths)
      })
      toast.success('Plan creado correctamente', toastOptions)
      setShowCreateModal(false)
      setCreateForm({
        name: '',
        durationMonths: 1,
        price: '',
        priceEfectivo: '',
        priceDebitoAutomatico: '',
        priceTarjetaTransferencia: '',
        description: '',
        isActive: true
      })
      fetchPlans()
    } catch (error) {
      console.error('Error creating plan:', error)
      toast.error('Error al crear el plan', toastOptions)
    } finally {
      setCreating(false)
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
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Planes de Membresía</h1>
          <p className="text-sm text-text-secondary mt-1">
            Administra los precios y configuración de los planes
          </p>
        </div>
        
        {isSuperAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            Nuevo Plan
          </button>
        )}
      </div>

      {/* Plans Table */}
      <div className="card overflow-hidden p-0">
        <table className="min-w-full divide-y divide-border-default">
          <thead>
            <tr className="bg-bg-surface">
              <th className="table-header">Plan</th>
              <th className="table-header">Duración</th>
              <th className="table-header">Precio Base</th>
              <th className="table-header">Descripción</th>
              <th className="table-header">Estado</th>
              <th className="table-header text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {plans.map((plan) => (
              <tr key={plan.id} className="table-row">
                <td className="table-cell">
                  <div className="font-medium capitalize">
                    {plan.name}
                  </div>
                </td>
                <td className="table-cell">
                  {plan.durationMonths} {plan.durationMonths === 1 ? 'mes' : 'meses'}
                </td>
                <td className="table-cell">
                  {editingId === plan.id ? (
                    <input
                      type="number"
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      className="form-input w-32"
                      step="0.01"
                    />
                  ) : (
                    <span className="font-semibold text-brand">
                      {formatCurrency(plan.price)}
                    </span>
                  )}
                </td>
                <td className="table-cell max-w-xs">
                  {editingId === plan.id ? (
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="form-input w-full"
                    />
                  ) : (
                    <span className="text-text-secondary truncate block">
                      {plan.description}
                    </span>
                  )}
                </td>
                <td className="table-cell">
                  {editingId === plan.id ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                        className="h-4 w-4 text-brand rounded border-border-default focus:ring-brand"
                      />
                      <span className="text-sm text-text-secondary">Activo</span>
                    </label>
                  ) : (
                    <span className={plan.isActive ? 'status-convertido' : 'status-perdido'}>
                      {plan.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  )}
                </td>
                <td className="table-cell text-right">
                  {editingId === plan.id ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => saveEdit(plan.id)}
                        className="p-1.5 text-success hover:bg-success/10 rounded transition-colors"
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1.5 text-error hover:bg-error/10 rounded transition-colors"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(plan)}
                      className="p-1.5 text-text-secondary hover:text-brand hover:bg-brand/10 rounded transition-colors"
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

      {/* Info Box */}
      <div className="card bg-info/5 border-info/20">
        <h3 className="text-sm font-medium text-info mb-2">💡 Información</h3>
        <ul className="text-sm text-text-secondary space-y-1">
          <li>• Los precios se muestran en pesos argentinos (ARS)</li>
          <li>• Los planes inactivos no aparecerán al crear nuevas membresías</li>
          <li>• La duración no se puede modificar una vez creado el plan</li>
          <li>• Los cambios de precio solo afectan a nuevas membresías</li>
        </ul>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-bg-secondary rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between p-4 border-b border-border-default">
                <h2 className="text-lg font-semibold text-text-primary">Nuevo Plan de Membresía</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 hover:bg-bg-surface rounded transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-text-secondary" />
                </button>
              </div>
              
              <form onSubmit={handleCreatePlan} className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Nombre del Plan *</label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      className="form-input"
                      placeholder="Ej: Mensual, Trimestral..."
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Duración (meses) *</label>
                    <select
                      value={createForm.durationMonths}
                      onChange={(e) => setCreateForm({ ...createForm, durationMonths: e.target.value })}
                      className="form-select"
                    >
                      <option value={1}>1 mes</option>
                      <option value={3}>3 meses</option>
                      <option value={6}>6 meses</option>
                      <option value={12}>12 meses</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Precio Base (ARS) *</label>
                  <input
                    type="number"
                    value={createForm.price}
                    onChange={(e) => setCreateForm({ ...createForm, price: e.target.value })}
                    className="form-input"
                    placeholder="0"
                    step="0.01"
                    required
                  />
                </div>

                <div className="border-t border-border-default pt-4">
                  <p className="text-sm text-text-secondary mb-3">Precios por método de pago (opcional)</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="form-label text-xs">Efectivo</label>
                      <input
                        type="number"
                        value={createForm.priceEfectivo}
                        onChange={(e) => setCreateForm({ ...createForm, priceEfectivo: e.target.value })}
                        className="form-input"
                        placeholder="Mismo que base"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs">Débito Auto.</label>
                      <input
                        type="number"
                        value={createForm.priceDebitoAutomatico}
                        onChange={(e) => setCreateForm({ ...createForm, priceDebitoAutomatico: e.target.value })}
                        className="form-input"
                        placeholder="Mismo que base"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="form-label text-xs">Tarjeta/Transf.</label>
                      <input
                        type="number"
                        value={createForm.priceTarjetaTransferencia}
                        onChange={(e) => setCreateForm({ ...createForm, priceTarjetaTransferencia: e.target.value })}
                        className="form-input"
                        placeholder="Mismo que base"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="form-label">Descripción</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="form-textarea"
                    rows={2}
                    placeholder="Descripción del plan..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={createForm.isActive}
                    onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                    className="h-4 w-4 text-brand rounded border-border-default focus:ring-brand"
                  />
                  <label htmlFor="isActive" className="text-sm text-text-secondary">
                    Plan activo (visible al crear membresías)
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="btn-primary disabled:opacity-50"
                  >
                    {creating ? 'Creando...' : 'Crear Plan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
