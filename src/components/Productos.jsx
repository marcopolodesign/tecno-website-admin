import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, PencilIcon, ExclamationTriangleIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'
import { toastOptions } from '../lib/themeStyles'
import { formatARS } from '../lib/dinero'
import { useSede } from '../contexts/SedeContext'
import { authService } from '../services/authService'
import productsService from '../services/productsService'
import Sidecart from './Sidecart'

const FORM_VACIO = {
  name: '',
  description: '',
  price: '',
  category: '',
  tracksStock: false,
  isActive: true,
  quantity: '',
  minQuantity: '',
}

export default function Productos({ userRole }) {
  const { sedeId, sede } = useSede()
  const esAdmin = userRole === 'admin' || userRole === 'super_admin'

  const [profile, setProfile] = useState(null)
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [verInactivos, setVerInactivos] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  const [ajustando, setAjustando] = useState(null) // producto
  const [ajusteDelta, setAjusteDelta] = useState('')
  const [ajusteReason, setAjusteReason] = useState('')
  const [ajusteMin, setAjusteMin] = useState('')
  const [enviandoAjuste, setEnviandoAjuste] = useState(false)

  useEffect(() => {
    authService.getCurrentUserProfile().then(setProfile).catch(() => setProfile(null))
  }, [])

  const cargar = useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    try {
      const { data } = await productsService.getProducts(sedeId, { includeInactive: verInactivos })
      setProductos(data)
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setLoading(false)
    }
  }, [sedeId, verInactivos])

  useEffect(() => { cargar() }, [cargar])

  const abrirNuevo = () => {
    setEditando(null)
    setForm(FORM_VACIO)
    setShowForm(true)
  }

  const abrirEdicion = (p) => {
    setEditando(p)
    setForm({
      name: p.name,
      description: p.description || '',
      price: p.price,
      category: p.category || '',
      tracksStock: p.tracksStock,
      isActive: p.isActive,
      quantity: '',
      minQuantity: p.minQuantity ?? '',
    })
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || form.price === '') {
      toast.error('Nombre y precio son obligatorios', toastOptions)
      return
    }
    setGuardando(true)
    try {
      if (editando) {
        await productsService.updateProduct(editando.id, { ...form, price: Number(form.price) })
        toast.success('Producto actualizado', toastOptions)
      } else {
        await productsService.createProduct(sedeId, { ...form, price: Number(form.price) })
        toast.success('Producto creado', toastOptions)
      }
      setShowForm(false)
      cargar()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setGuardando(false)
    }
  }

  const abrirAjuste = (p) => {
    setAjustando(p)
    setAjusteDelta('')
    setAjusteReason('')
    setAjusteMin(p.minQuantity ?? 0)
  }

  const handleAjustar = async (e) => {
    e.preventDefault()
    if (!ajustando || !profile) return
    const delta = Number(ajusteDelta)
    if (!delta) {
      toast.error('La cantidad tiene que ser distinta de cero', toastOptions)
      return
    }
    setEnviandoAjuste(true)
    try {
      await productsService.ajustarStock({
        productId: ajustando.id,
        locationId: sedeId,
        delta,
        reason: ajusteReason,
        sellerId: profile.id,
        minQuantity: ajusteMin === '' ? undefined : Number(ajusteMin),
      })
      toast.success('Stock actualizado', toastOptions)
      setAjustando(null)
      cargar()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setEnviandoAjuste(false)
    }
  }

  const productosFiltrados = productos.filter((p) =>
    p.name.toLowerCase().includes(busqueda.trim().toLowerCase())
  )

  if (loading && productos.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Productos</h1>
          <p className="text-sm text-text-secondary mt-1">{sede?.name || 'Sede'} — lo que se vende por mostrador</p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          Nuevo producto
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          className="form-input max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={verInactivos}
            onChange={(e) => setVerInactivos(e.target.checked)}
            className="h-4 w-4 text-brand rounded border-border-default focus:ring-brand"
          />
          Ver inactivos
        </label>
      </div>

      <div className="card border-0 shadow-none">
        {productosFiltrados.length === 0 ? (
          <p className="text-sm text-text-tertiary text-center py-8">Sin productos todavía</p>
        ) : (
          <div className="overflow-x-auto -mx-1.5">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-header">Producto</th>
                  <th className="table-header">Categoría</th>
                  <th className="table-header">Precio</th>
                  <th className="table-header">Stock</th>
                  <th className="table-header">Estado</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map((p) => {
                  const bajoStock = p.tracksStock && p.quantity !== null && p.quantity <= (p.minQuantity ?? 0)
                  return (
                    <tr key={p.id} className={`table-row ${!p.isActive ? 'opacity-50' : ''}`}>
                      <td className="table-cell">
                        <p className="font-medium text-text-primary">{p.name}</p>
                        {p.description && <p className="text-xs text-text-tertiary">{p.description}</p>}
                      </td>
                      <td className="table-cell">{p.category || '—'}</td>
                      <td className="table-cell">{formatARS(p.price)}</td>
                      <td className="table-cell">
                        {p.tracksStock ? (
                          <span className={`inline-flex items-center gap-1 ${bajoStock ? 'text-warning font-medium' : ''}`}>
                            {bajoStock && <ExclamationTriangleIcon className="h-3.5 w-3.5" />}
                            {p.quantity ?? 0}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">Sin stock</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={`status-badge ${p.isActive ? 'status-convertido' : 'status-perdido'}`}>
                          {p.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="table-cell text-right whitespace-nowrap">
                        {p.tracksStock && (
                          <button
                            onClick={() => abrirAjuste(p)}
                            className="p-1.5 text-text-secondary hover:text-brand hover:bg-brand/10 rounded transition-colors"
                            title="Ajustar stock"
                          >
                            <ArrowsUpDownIcon className="h-4 w-4" />
                          </button>
                        )}
                        {esAdmin && (
                          <button
                            onClick={() => abrirEdicion(p)}
                            className="p-1.5 text-text-secondary hover:text-brand hover:bg-brand/10 rounded transition-colors"
                            title="Editar"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alta / edición */}
      <Sidecart
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editando ? 'Editar producto' : 'Nuevo producto'}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleSubmit} disabled={guardando} className="btn-primary disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Guardar'}
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
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Categoría</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="form-input"
              placeholder="Ej: Bebidas, Suplementos..."
            />
          </div>
          <div>
            <label className="form-label">Precio *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="form-textarea"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="tracksStock"
              checked={form.tracksStock}
              disabled={!!editando}
              onChange={(e) => setForm({ ...form, tracksStock: e.target.checked })}
              className="h-4 w-4 text-brand rounded border-border-default focus:ring-brand disabled:opacity-50"
            />
            <label htmlFor="tracksStock" className="text-sm text-text-secondary">
              Lleva stock
            </label>
          </div>
          {editando && (
            <p className="text-xs text-text-tertiary -mt-2">
              Si lleva stock no se cambia acá — usá "Ajustar stock" en la lista.
            </p>
          )}

          {!editando && form.tracksStock && (
            <div className="grid grid-cols-2 gap-3 border-t border-border-default pt-4">
              <div>
                <label className="form-label text-xs">Stock inicial</label>
                <input
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="form-input"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="form-label text-xs">Mínimo</label>
                <input
                  type="number"
                  min="0"
                  value={form.minQuantity}
                  onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
                  className="form-input"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 text-brand rounded border-border-default focus:ring-brand"
            />
            <label htmlFor="isActive" className="text-sm text-text-secondary">
              Activo (visible al vender)
            </label>
          </div>
        </form>
      </Sidecart>

      {/* Ajuste de stock */}
      <Sidecart
        isOpen={!!ajustando}
        onClose={() => setAjustando(null)}
        title={`Ajustar stock — ${ajustando?.name || ''}`}
        subtitle={`Hay ${ajustando?.quantity ?? 0} unidades ahora`}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setAjustando(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleAjustar} disabled={enviandoAjuste} className="btn-primary disabled:opacity-50">
              {enviandoAjuste ? 'Guardando...' : 'Ajustar'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleAjustar} className="space-y-4">
          <div>
            <label className="form-label">Cantidad *</label>
            <input
              type="number"
              required
              value={ajusteDelta}
              onChange={(e) => setAjusteDelta(e.target.value)}
              className="form-input"
              placeholder="Positivo repone, negativo da de baja (ej: -2)"
              autoFocus
            />
            {ajusteDelta !== '' && !Number.isNaN(Number(ajusteDelta)) && (
              <p className="text-xs text-text-tertiary mt-1">
                Queda en {(ajustando?.quantity ?? 0) + Number(ajusteDelta)} unidades
              </p>
            )}
          </div>
          <div>
            <label className="form-label">Motivo *</label>
            <textarea
              required
              value={ajusteReason}
              onChange={(e) => setAjusteReason(e.target.value)}
              className="form-textarea"
              rows={2}
              placeholder="Ej: reposición, merma, corrección de conteo..."
            />
          </div>
          <div>
            <label className="form-label">Mínimo (aviso de stock bajo)</label>
            <input
              type="number"
              min="0"
              value={ajusteMin}
              onChange={(e) => setAjusteMin(e.target.value)}
              className="form-input"
            />
          </div>
        </form>
      </Sidecart>
    </div>
  )
}
