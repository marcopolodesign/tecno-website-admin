import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  PlusIcon,
  PencilIcon,
  ExclamationTriangleIcon,
  ArchiveBoxArrowDownIcon,
  ClockIcon,
  EyeSlashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'
import { toastOptions } from '../lib/themeStyles'
import { formatARS } from '../lib/dinero'
import { useSede } from '../contexts/SedeContext'
import productsService from '../services/productsService'
import Sidecart from './Sidecart'

const FORM_VACIO = {
  nombre: '',
  categoria: '',
  precio: '',
  llevaStock: false,
  stockMinimo: '',
  activo: true,
}

const TIPO_LABEL = {
  carga: 'Carga',
  venta: 'Venta',
  ajuste: 'Ajuste',
  anulacion: 'Anulación',
}

function fechaHora(iso) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Productos() {
  const { sedeId, sede } = useSede()

  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')
  const [soloReposicion, setSoloReposicion] = useState(false)
  const [verInactivos, setVerInactivos] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  const [movimiento, setMovimiento] = useState(null) // producto sobre el que se está cargando/ajustando stock
  const [movCantidad, setMovCantidad] = useState('')
  const [movMotivo, setMovMotivo] = useState('')
  const [enviandoMov, setEnviandoMov] = useState(false)

  const [historialDe, setHistorialDe] = useState(null) // producto
  const [historial, setHistorial] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

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

  const categorias = useMemo(() => {
    const set = new Set(productos.map((p) => p.categoria).filter(Boolean))
    return Array.from(set).sort()
  }, [productos])

  const necesitanReposicion = useMemo(
    () => productos.filter((p) => p.activo && p.llevaStock && p.stockActual <= p.stockMinimo),
    [productos]
  )

  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      if (busqueda.trim() && !p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())) return false
      if (categoriaFiltro !== 'todas' && p.categoria !== categoriaFiltro) return false
      if (soloReposicion && !(p.llevaStock && p.stockActual <= p.stockMinimo)) return false
      return true
    })
  }, [productos, busqueda, categoriaFiltro, soloReposicion])

  // --- Alta / edición -------------------------------------------------------

  const abrirNuevo = () => {
    setEditando(null)
    setForm(FORM_VACIO)
    setShowForm(true)
  }

  const abrirEdicion = (p) => {
    setEditando(p)
    setForm({
      nombre: p.nombre,
      categoria: p.categoria || '',
      precio: p.precio,
      llevaStock: p.llevaStock,
      stockMinimo: p.stockMinimo ?? '',
      activo: p.activo,
    })
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim() || form.precio === '') {
      toast.error('Nombre y precio son obligatorios', toastOptions)
      return
    }
    setGuardando(true)
    try {
      if (editando) {
        await productsService.updateProduct(editando.id, form)
        toast.success('Producto actualizado', toastOptions)
      } else {
        await productsService.createProduct(sedeId, form)
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

  // --- Cargar mercadería / ajuste a la baja --------------------------------

  const abrirMovimiento = (p) => {
    setMovimiento(p)
    setMovCantidad('')
    setMovMotivo('')
  }

  const handleMovimiento = async (e) => {
    e.preventDefault()
    if (!movimiento) return
    setEnviandoMov(true)
    try {
      await productsService.cargarStock(movimiento.id, movCantidad, movMotivo)
      toast.success('Stock actualizado', toastOptions)
      setMovimiento(null)
      cargar()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setEnviandoMov(false)
    }
  }

  // --- Historial ------------------------------------------------------------

  const abrirHistorial = async (p) => {
    setHistorialDe(p)
    setCargandoHistorial(true)
    try {
      const { data } = await productsService.getMovimientos(p.id)
      setHistorial(data)
    } catch (err) {
      toast.error(err.message, toastOptions)
      setHistorial([])
    } finally {
      setCargandoHistorial(false)
    }
  }

  // --- Activar / desactivar --------------------------------------------------

  const toggleActivo = async (p) => {
    const accion = p.activo ? 'desactivar' : 'reactivar'
    const mensaje = p.activo
      ? `¿Desactivar "${p.nombre}"? Deja de poder venderse, pero las ventas viejas siguen mostrándolo.`
      : `¿Reactivar "${p.nombre}"?`
    if (!confirm(mensaje)) return
    try {
      await productsService.setActivo(p.id, !p.activo)
      toast.success(p.activo ? 'Producto desactivado' : 'Producto reactivado', toastOptions)
      cargar()
    } catch (err) {
      toast.error(err.message, toastOptions)
    }
  }

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

      {necesitanReposicion.length > 0 && (
        <button
          onClick={() => setSoloReposicion((v) => !v)}
          className={`w-full text-left rounded-xl p-4 flex items-start gap-3 transition-colors ${
            soloReposicion ? 'bg-warning/15' : 'bg-warning/5 hover:bg-warning/10'
          }`}
        >
          <ExclamationTriangleIcon className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-text-primary">
              {necesitanReposicion.length === 1
                ? '1 producto necesita reposición'
                : `${necesitanReposicion.length} productos necesitan reposición`}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              {necesitanReposicion.map((p) => p.nombre).join(', ')}
              {' — '}
              {soloReposicion ? 'tocá para ver todos' : 'tocá para filtrar sólo estos'}
            </p>
          </div>
        </button>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          className="form-input max-w-xs"
        />
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="form-input max-w-[12rem]"
        >
          <option value="todas">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
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
          <p className="text-sm text-text-tertiary text-center py-8">Sin productos para este filtro</p>
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
                  const bajoStock = p.llevaStock && p.stockActual <= p.stockMinimo
                  return (
                    <tr key={p.id} className={`table-row ${!p.activo ? 'opacity-50' : ''}`}>
                      <td className="table-cell font-medium text-text-primary">{p.nombre}</td>
                      <td className="table-cell">{p.categoria || '—'}</td>
                      <td className="table-cell">{formatARS(p.precio)}</td>
                      <td className="table-cell">
                        {p.llevaStock ? (
                          <span className={`inline-flex items-center gap-1 ${bajoStock ? 'text-warning font-medium' : ''}`}>
                            {bajoStock && <ExclamationTriangleIcon className="h-3.5 w-3.5" />}
                            {p.stockActual}
                            <span className="text-text-tertiary font-normal">/ mín. {p.stockMinimo}</span>
                          </span>
                        ) : (
                          <span className="text-text-tertiary">Sin stock</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={`status-badge ${p.activo ? 'status-convertido' : 'status-perdido'}`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="table-cell text-right whitespace-nowrap">
                        {p.llevaStock && (
                          <button
                            onClick={() => abrirMovimiento(p)}
                            className="p-1.5 text-text-secondary hover:text-brand hover:bg-brand/10 rounded transition-colors"
                            title="Cargar / ajustar stock"
                          >
                            <ArchiveBoxArrowDownIcon className="h-4 w-4" />
                          </button>
                        )}
                        {p.llevaStock && (
                          <button
                            onClick={() => abrirHistorial(p)}
                            className="p-1.5 text-text-secondary hover:text-brand hover:bg-brand/10 rounded transition-colors"
                            title="Historial de movimientos"
                          >
                            <ClockIcon className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => abrirEdicion(p)}
                          className="p-1.5 text-text-secondary hover:text-brand hover:bg-brand/10 rounded transition-colors"
                          title="Editar"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleActivo(p)}
                          className="p-1.5 text-text-secondary hover:text-brand hover:bg-brand/10 rounded transition-colors"
                          title={p.activo ? 'Desactivar' : 'Reactivar'}
                        >
                          {p.activo ? <EyeSlashIcon className="h-4 w-4" /> : <CheckCircleIcon className="h-4 w-4" />}
                        </button>
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
              autoFocus
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Categoría</label>
            <input
              type="text"
              list="categorias-existentes"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="form-input"
              placeholder="Ej: Bebidas, Suplementos..."
            />
            <datalist id="categorias-existentes">
              {categorias.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="form-label">Precio *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="flex items-center gap-2 border-t border-border-default pt-4">
            <input
              type="checkbox"
              id="llevaStock"
              checked={form.llevaStock}
              onChange={(e) => setForm({ ...form, llevaStock: e.target.checked })}
              className="h-4 w-4 text-brand rounded border-border-default focus:ring-brand"
            />
            <label htmlFor="llevaStock" className="text-sm text-text-secondary">
              Lleva stock
            </label>
          </div>
          <p className="text-xs text-text-tertiary -mt-2">
            Apagado para servicios sueltos (una clase, un día de invitado) que siempre se pueden vender.
          </p>

          {form.llevaStock && (
            <div>
              <label className="form-label text-xs">Stock mínimo</label>
              <input
                type="number"
                min="0"
                value={form.stockMinimo}
                onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
                className="form-input"
                placeholder="0"
              />
              <p className="text-xs text-text-tertiary mt-1">
                {editando
                  ? 'Debajo de este número se marca como "necesita reposición". Para cambiar la cantidad usá "Cargar / ajustar stock" en la lista.'
                  : 'Debajo de este número se marca como "necesita reposición". El producto arranca en 0 unidades — cargá mercadería después de crearlo.'}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activo"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              className="h-4 w-4 text-brand rounded border-border-default focus:ring-brand"
            />
            <label htmlFor="activo" className="text-sm text-text-secondary">
              Activo (visible al vender)
            </label>
          </div>
        </form>
      </Sidecart>

      {/* Cargar mercadería / ajuste a la baja */}
      <Sidecart
        isOpen={!!movimiento}
        onClose={() => setMovimiento(null)}
        title={`Stock — ${movimiento?.nombre || ''}`}
        subtitle={`Hay ${movimiento?.stockActual ?? 0} unidades ahora`}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setMovimiento(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleMovimiento} disabled={enviandoMov} className="btn-primary disabled:opacity-50">
              {enviandoMov ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleMovimiento} className="space-y-4">
          <div>
            <label className="form-label">Cantidad *</label>
            <input
              type="number"
              required
              value={movCantidad}
              onChange={(e) => setMovCantidad(e.target.value)}
              className="form-input"
              placeholder="Positivo repone, negativo da de baja (ej: -2)"
              autoFocus
            />
            {movCantidad !== '' && !Number.isNaN(Number(movCantidad)) && Number(movCantidad) !== 0 && (
              <p className="text-xs text-text-tertiary mt-1">
                Queda en {(movimiento?.stockActual ?? 0) + Number(movCantidad)} unidades
              </p>
            )}
          </div>
          <div>
            <label className="form-label">Motivo *</label>
            <textarea
              required
              value={movMotivo}
              onChange={(e) => setMovMotivo(e.target.value)}
              className="form-textarea"
              rows={2}
              placeholder="Ej: compra proveedor, rotura, vencido, corrección de conteo..."
            />
          </div>
        </form>
      </Sidecart>

      {/* Historial de movimientos */}
      <Sidecart
        isOpen={!!historialDe}
        onClose={() => setHistorialDe(null)}
        title={`Historial — ${historialDe?.nombre || ''}`}
        subtitle={`${historialDe?.stockActual ?? 0} unidades ahora`}
        size="sm"
      >
        {cargandoHistorial ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : historial.length === 0 ? (
          <p className="text-sm text-text-tertiary text-center py-8">Todavía no hay movimientos</p>
        ) : (
          <ul className="space-y-3">
            {historial.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 pb-3 border-b border-border-default last:border-0">
                <div>
                  <p className="text-sm text-text-primary">
                    <span className="font-medium">{TIPO_LABEL[m.tipo] || m.tipo}</span>
                    {m.motivo && <span className="text-text-secondary"> — {m.motivo}</span>}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {fechaHora(m.createdAt)}
                    {m.sellers && ` · ${m.sellers.firstName} ${m.sellers.lastName}`}
                  </p>
                </div>
                <span className={`text-sm font-medium whitespace-nowrap ${m.cantidad > 0 ? 'text-success' : 'text-error'}`}>
                  {m.cantidad > 0 ? '+' : ''}{m.cantidad}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Sidecart>
    </div>
  )
}
