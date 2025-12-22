import { useState, useEffect } from 'react'
import { PencilIcon, PlusIcon } from '@heroicons/react/24/outline'
import membershipPlansService from '../services/membershipPlansService'
import toast, { Toaster } from 'react-hot-toast'
import { toastOptions } from '../lib/themeStyles'
import Modal from './Modal'

export default function MembershipPlans({ userRole }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
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
    setEditingPlan(plan)
    setEditForm({
      price: plan.price || '',
      priceEfectivo: plan.priceEfectivo || plan.price || '',
      priceDebitoAutomatico: plan.priceDebitoAutomatico || plan.price || '',
      priceTarjetaTransferencia: plan.priceTarjetaTransferencia || plan.price || '',
      description: plan.description || '',
      isActive: plan.isActive
    })
    setShowEditModal(true)
  }

  const cancelEdit = () => {
    setShowEditModal(false)
    setEditingPlan(null)
    setEditForm({})
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!editingPlan) return

    try {
      setSaving(true)
      await membershipPlansService.updatePlan(editingPlan.id, {
        price: parseFloat(editForm.price),
        priceEfectivo: parseFloat(editForm.priceEfectivo) || parseFloat(editForm.price),
        priceDebitoAutomatico: parseFloat(editForm.priceDebitoAutomatico) || parseFloat(editForm.price),
        priceTarjetaTransferencia: parseFloat(editForm.priceTarjetaTransferencia) || parseFloat(editForm.price),
        description: editForm.description,
        isActive: editForm.isActive
      })
      toast.success('Plan actualizado correctamente', toastOptions)
      setShowEditModal(false)
      setEditingPlan(null)
      setEditForm({})
      fetchPlans()
    } catch (error) {
      console.error('Error updating plan:', error)
      toast.error('Error al actualizar el plan', toastOptions)
    } finally {
      setSaving(false)
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
    if (!amount && amount !== 0) return '-'
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

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className={`card ${!plan.isActive ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-text-primary capitalize">{plan.name}</h3>
                <p className="text-sm text-text-secondary">
                  {plan.durationMonths} {plan.durationMonths === 1 ? 'mes' : 'meses'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`status-badge ${plan.isActive ? 'status-convertido' : 'status-perdido'}`}>
                  {plan.isActive ? 'Activo' : 'Inactivo'}
                </span>
                <button
                  onClick={() => startEdit(plan)}
                  className="p-1.5 text-text-secondary hover:text-brand hover:bg-brand/10 rounded transition-colors"
                  title="Editar plan"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Prices */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border-default">
                <span className="text-sm text-text-secondary">Precio Base</span>
                <span className="text-lg font-bold text-brand">{formatCurrency(plan.price)}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-bg-surface rounded-lg">
                  <p className="text-xs text-text-tertiary mb-1">Efectivo</p>
                  <p className="text-sm font-semibold text-text-primary">{formatCurrency(plan.priceEfectivo)}</p>
                </div>
                <div className="p-2 bg-bg-surface rounded-lg">
                  <p className="text-xs text-text-tertiary mb-1">Débito Auto.</p>
                  <p className="text-sm font-semibold text-text-primary">{formatCurrency(plan.priceDebitoAutomatico)}</p>
                </div>
                <div className="p-2 bg-bg-surface rounded-lg">
                  <p className="text-xs text-text-tertiary mb-1">Tarjeta/Transf.</p>
                  <p className="text-sm font-semibold text-text-primary">{formatCurrency(plan.priceTarjetaTransferencia)}</p>
                </div>
              </div>
            </div>

            {plan.description && (
              <p className="mt-4 text-sm text-text-secondary">{plan.description}</p>
            )}
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center py-12 card">
          <p className="text-text-secondary">No hay planes de membresía configurados</p>
          {isSuperAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary mt-4"
            >
              Crear primer plan
            </button>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="card bg-info/5 border-info/20">
        <h3 className="text-sm font-medium text-info mb-2">💡 Información</h3>
        <ul className="text-sm text-text-secondary space-y-1">
          <li>• Los precios se muestran en pesos argentinos (ARS)</li>
          <li>• Los planes inactivos no aparecerán al crear nuevas membresías</li>
          <li>• La duración no se puede modificar una vez creado el plan</li>
          <li>• Los cambios de precio solo afectan a nuevas membresías</li>
          <li>• <strong>Efectivo:</strong> Precio cuando pagan en efectivo</li>
          <li>• <strong>Débito Automático:</strong> Precio para débito recurrente</li>
          <li>• <strong>Tarjeta/Transferencia:</strong> Precio para pago con tarjeta o transferencia</li>
        </ul>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal && !!editingPlan}
        onClose={cancelEdit}
        title="Editar Plan"
        subtitle={editingPlan ? `${editingPlan.name} - ${editingPlan.durationMonths} ${editingPlan.durationMonths === 1 ? 'mes' : 'meses'}` : ''}
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={cancelEdit} className="btn-secondary">
              Cancelar
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        }
      >
        <form onSubmit={saveEdit} className="space-y-4">
          <div>
            <label className="form-label">Precio Base (ARS) *</label>
            <input
              type="number"
              value={editForm.price}
              onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
              className="form-input"
              placeholder="0"
              step="0.01"
              required
            />
          </div>

          <div className="border-t border-border-default pt-4">
            <p className="text-sm font-medium text-text-primary mb-3">Precios por Método de Pago</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label text-xs">Efectivo</label>
                <input
                  type="number"
                  value={editForm.priceEfectivo}
                  onChange={(e) => setEditForm({ ...editForm, priceEfectivo: e.target.value })}
                  className="form-input"
                  placeholder="Mismo que base"
                  step="0.01"
                />
              </div>
              <div>
                <label className="form-label text-xs">Débito Auto.</label>
                <input
                  type="number"
                  value={editForm.priceDebitoAutomatico}
                  onChange={(e) => setEditForm({ ...editForm, priceDebitoAutomatico: e.target.value })}
                  className="form-input"
                  placeholder="Mismo que base"
                  step="0.01"
                />
              </div>
              <div>
                <label className="form-label text-xs">Tarjeta/Transf.</label>
                <input
                  type="number"
                  value={editForm.priceTarjetaTransferencia}
                  onChange={(e) => setEditForm({ ...editForm, priceTarjetaTransferencia: e.target.value })}
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
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="form-textarea"
              rows={2}
              placeholder="Descripción del plan..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="editIsActive"
              checked={editForm.isActive}
              onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
              className="h-4 w-4 text-brand rounded border-border-default focus:ring-brand"
            />
            <label htmlFor="editIsActive" className="text-sm text-text-secondary">
              Plan activo (visible al crear membresías)
            </label>
          </div>
        </form>
      </Modal>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nuevo Plan de Membresía"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button
              onClick={handleCreatePlan}
              disabled={creating}
              className="btn-primary disabled:opacity-50"
            >
              {creating ? 'Creando...' : 'Crear Plan'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreatePlan} className="space-y-4">
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
            <p className="text-sm font-medium text-text-primary mb-3">Precios por Método de Pago</p>
            <p className="text-xs text-text-tertiary mb-3">Deja vacío para usar el precio base</p>
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
        </form>
      </Modal>
    </div>
  )
}
