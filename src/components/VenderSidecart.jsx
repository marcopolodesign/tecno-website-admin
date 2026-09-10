import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  MagnifyingGlassIcon,
  TrashIcon,
  PlusIcon,
  MinusIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { toastOptions } from '../lib/themeStyles'
import { formatARS } from '../lib/dinero'
import { supabase } from '../lib/supabase'
import Sidecart from './Sidecart'
import cajaService, { METODOS_PAGO } from '../services/cajaService'
import productsService from '../services/productsService'
import membershipPlansService from '../services/membershipPlansService'

// El mostrador: buscar productos/planes, armar el carrito, elegir socio (o consumidor
// final) y cobrar — con o sin pago partido.
//
// Va en un Sidecart, no en su propia ruta, por la misma razón que el resto de lo que se
// crea en el admin (Modal/Sidecart para editar y crear en cualquier pantalla): vender es una
// ACCIÓN dentro de la pantalla de Caja, no una sección propia que alguien visita sola — nunca
// se abre "a vender" sin antes tener una caja abierta a la vista. Mantenerla flotando sobre
// Caja evita perder el resumen del turno de fondo mientras se arma la venta.
//
// Decisión a revisar: el precio de un plan en el carrito es el precio BASE del plan
// (`membership_plans.price`), no el de "precio por método de pago" que usa la renovación
// normal en Users.jsx — con pago partido no hay un único método al que atarle ese precio
// diferencial. Si hace falta diferenciar precio por método acá también, es un cambio de
// producto, no técnico.
export default function VenderSidecart({ isOpen, onClose, sedeId, sellerId, cajaAbierta, onSold }) {
  const [cargando, setCargando] = useState(false)
  const [productos, setProductos] = useState([])
  const [planes, setPlanes] = useState([])
  const [tab, setTab] = useState('productos') // 'productos' | 'planes'
  const [busqueda, setBusqueda] = useState('')

  const [carrito, setCarrito] = useState([])

  const [socio, setSocio] = useState(null)
  const [socioQuery, setSocioQuery] = useState('')
  const [socioResultados, setSocioResultados] = useState([])
  const [buscandoSocio, setBuscandoSocio] = useState(false)

  const [pagos, setPagos] = useState([{ method: 'efectivo', amount: '' }])
  const [notes, setNotes] = useState('')
  const [enviando, setEnviando] = useState(false)

  const resetForm = useCallback(() => {
    setCarrito([])
    setSocio(null)
    setSocioQuery('')
    setSocioResultados([])
    setPagos([{ method: 'efectivo', amount: '' }])
    setNotes('')
    setBusqueda('')
    setTab('productos')
  }, [])

  useEffect(() => {
    if (!isOpen || !sedeId) return
    resetForm()
    setCargando(true)
    Promise.all([productsService.getProducts(sedeId), membershipPlansService.getPlans()])
      .then(([prod, plan]) => {
        setProductos(prod.data || [])
        setPlanes(plan.data || [])
      })
      .catch((err) => toast.error(err.message, toastOptions))
      .finally(() => setCargando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sedeId])

  // Buscar socio — debounce simple, sin librería aparte por dos letras que se tipean acá.
  useEffect(() => {
    if (!socioQuery || socioQuery.trim().length < 2) {
      setSocioResultados([])
      return
    }
    const q = socioQuery.trim()
    setBuscandoSocio(true)
    const id = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, phone, current_membership_id, membership_status')
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(8)
        if (error) throw error
        setSocioResultados(data || [])
      } catch (err) {
        toast.error(err.message, toastOptions)
      } finally {
        setBuscandoSocio(false)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [socioQuery])

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return productos
    return productos.filter((p) => p.name.toLowerCase().includes(q))
  }, [productos, busqueda])

  const planesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return planes
    return planes.filter((p) => p.name.toLowerCase().includes(q))
  }, [planes, busqueda])

  const hayPlanEnCarrito = carrito.some((i) => i.kind === 'plan')

  const agregarProducto = (p) => {
    setCarrito((prev) => {
      const existente = prev.find((i) => i.kind === 'producto' && i.productId === p.id)
      if (existente) {
        return prev.map((i) =>
          i.key === existente.key ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...prev,
        {
          key: `producto-${p.id}`,
          kind: 'producto',
          productId: p.id,
          description: p.name,
          unitPrice: Number(p.price),
          quantity: 1,
          tracksStock: p.tracksStock,
          stockDisponible: p.quantity,
        },
      ]
    })
  }

  const agregarPlan = (plan) => {
    if (hayPlanEnCarrito) {
      toast.error('Ya hay una membresía en el carrito — sólo se puede vender una por venta.', toastOptions)
      return
    }
    setCarrito((prev) => [
      ...prev,
      {
        key: `plan-${plan.id}`,
        kind: 'plan',
        membershipPlanId: plan.id,
        description: `Membresía ${plan.name}`,
        unitPrice: Number(plan.price),
        quantity: 1,
        durationMonths: plan.durationMonths,
      },
    ])
  }

  const cambiarCantidad = (key, next) => {
    if (next < 1) {
      setCarrito((prev) => prev.filter((i) => i.key !== key))
      return
    }
    setCarrito((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: next } : i)))
  }

  const quitarItem = (key) => setCarrito((prev) => prev.filter((i) => i.key !== key))

  const total = carrito.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
  const cobrado = pagos.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
  const diferencia = total - cobrado

  const cambiarPago = (idx, campo, valor) => {
    setPagos((prev) => prev.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)))
  }

  const agregarLineaPago = () => {
    const restante = Math.max(total - cobrado, 0)
    setPagos((prev) => [...prev, { method: 'efectivo', amount: restante ? String(restante) : '' }])
  }

  const quitarLineaPago = (idx) => setPagos((prev) => prev.filter((_, i) => i !== idx))

  const elegirSocio = (u) => {
    setSocio(u)
    setSocioQuery('')
    setSocioResultados([])
  }

  const puedeEnviar = carrito.length > 0 && !enviando && (!hayPlanEnCarrito || !!socio)

  const handleSubmit = async () => {
    if (!carrito.length) return
    // Único bloqueo que sí hacemos en el front: la RPC no sabe que un renglón es una
    // "membresía" en el sentido de negocio (product_id/membership_plan_id le da lo mismo
    // fiar consumidor final que a un socio), así que esto no está validado del otro lado.
    if (hayPlanEnCarrito && !socio) {
      toast.error('Elegí un socio antes de cobrar — la membresía necesita a quién asignarse.', toastOptions)
      return
    }

    const pagosValidos = pagos.filter((p) => Number(p.amount) > 0)

    setEnviando(true)
    try {
      const venta = await cajaService.registrarVenta({
        locationId: sedeId,
        sellerId,
        items: carrito.map((i) => ({
          productId: i.kind === 'producto' ? i.productId : undefined,
          membershipPlanId: i.kind === 'plan' ? i.membershipPlanId : undefined,
          description: i.description,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
        })),
        payments: pagosValidos.map((p) => ({ method: p.method, amount: Number(p.amount) })),
        userId: socio?.id || null,
        notes: notes.trim() || null,
      })
      toast.success(`Venta #${venta.numero} registrada — ${formatARS(venta.total)}`, toastOptions)
      resetForm()
      onSold?.()
      onClose()
    } catch (err) {
      // El mensaje ya viene en castellano desde la RPC (o desde cajaService si falló la
      // membresía) — se muestra tal cual, sin traducir ni resumir.
      toast.error(err.message, toastOptions)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Sidecart
      isOpen={isOpen}
      onClose={onClose}
      title="Vender"
      subtitle={cajaAbierta ? `Turno abierto — ${cajaAbierta.sellers ? `${cajaAbierta.sellers.firstName} ${cajaAbierta.sellers.lastName}` : ''}` : ''}
      size="xl"
      zIndex={60}
      footer={
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Total</span>
            <span className="font-semibold text-text-primary">{formatARS(total)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Cobrado</span>
            <span className="font-semibold text-text-primary">{formatARS(cobrado)}</span>
          </div>
          {diferencia > 0.009 && (
            <div className="flex items-center justify-between text-sm rounded-lg bg-warning/10 px-3 py-2">
              <span className="text-warning font-medium">
                {socio ? 'Queda fiado' : 'Falta cobrar'}
              </span>
              <span className="text-warning font-semibold">{formatARS(diferencia)}</span>
            </div>
          )}
          {diferencia < -0.009 && (
            <div className="flex items-center justify-between text-sm rounded-lg bg-error/10 px-3 py-2">
              <span className="text-error font-medium">Se cobró de más</span>
              <span className="text-error font-semibold">{formatARS(-diferencia)}</span>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={!puedeEnviar}
            className="btn-primary w-full justify-center disabled:opacity-50"
          >
            {enviando ? 'Cobrando...' : 'Cobrar venta'}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Buscador de catálogo */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => setTab('productos')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === 'productos' ? 'bg-brand text-white' : 'bg-bg-surface text-text-secondary'
              }`}
            >
              Productos
            </button>
            <button
              type="button"
              onClick={() => setTab('planes')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tab === 'planes' ? 'bg-brand text-white' : 'bg-bg-surface text-text-secondary'
              }`}
            >
              Membresías
            </button>
          </div>

          <div className="relative mb-3">
            <MagnifyingGlassIcon className="h-4 w-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={tab === 'productos' ? 'Buscar producto...' : 'Buscar plan...'}
              className="form-input pl-9"
            />
          </div>

          {cargando ? (
            <div className="h-24 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tab === 'productos' ? (
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
              {productosFiltrados.map((p) => {
                const sinStock = p.tracksStock && (p.quantity ?? 0) <= 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => agregarProducto(p)}
                    className="text-left p-2.5 rounded-lg bg-bg-surface hover:bg-bg-surface-hover transition-colors"
                  >
                    <p className="text-sm font-medium text-text-primary truncate">{p.name}</p>
                    <p className="text-xs text-text-secondary">{formatARS(p.price)}</p>
                    {p.tracksStock && (
                      <p className={`text-[11px] mt-0.5 ${sinStock ? 'text-error' : 'text-text-tertiary'}`}>
                        {sinStock ? 'Sin stock' : `${p.quantity} en stock`}
                      </p>
                    )}
                  </button>
                )
              })}
              {productosFiltrados.length === 0 && (
                <p className="col-span-2 text-sm text-text-tertiary text-center py-6">Sin productos</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
              {planesFiltrados.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => agregarPlan(plan)}
                  className="text-left p-2.5 rounded-lg bg-bg-surface hover:bg-bg-surface-hover transition-colors"
                >
                  <p className="text-sm font-medium text-text-primary truncate">{plan.name}</p>
                  <p className="text-xs text-text-secondary">{formatARS(plan.price)} · {plan.durationMonths} {plan.durationMonths === 1 ? 'mes' : 'meses'}</p>
                </button>
              ))}
              {planesFiltrados.length === 0 && (
                <p className="col-span-2 text-sm text-text-tertiary text-center py-6">Sin planes</p>
              )}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-2">Carrito</p>
          {carrito.length === 0 ? (
            <p className="text-sm text-text-tertiary py-4 text-center bg-bg-surface rounded-lg">
              Todavía no agregaste nada
            </p>
          ) : (
            <div className="space-y-1.5">
              {carrito.map((item) => (
                <div key={item.key} className="flex items-center gap-2 p-2 rounded-lg bg-bg-surface">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{item.description}</p>
                    <p className="text-xs text-text-tertiary">{formatARS(item.unitPrice)} c/u</p>
                  </div>
                  {item.kind === 'producto' ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(item.key, item.quantity - 1)}
                        className="p-1 rounded-md hover:bg-bg-surface-hover text-text-secondary"
                      >
                        <MinusIcon className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm w-5 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(item.key, item.quantity + 1)}
                        className="p-1 rounded-md hover:bg-bg-surface-hover text-text-secondary"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-brand font-medium px-2 py-0.5 rounded-full bg-brand/10">
                      Membresía
                    </span>
                  )}
                  <span className="text-sm font-semibold text-text-primary w-20 text-right">
                    {formatARS(item.unitPrice * item.quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => quitarItem(item.key)}
                    className="p-1 text-text-tertiary hover:text-error transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Socio */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-2">
            Socio {hayPlanEnCarrito && <span className="text-error">— obligatorio, hay una membresía en el carrito</span>}
          </p>
          {socio ? (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-brand/5">
              <UserCircleIcon className="h-8 w-8 text-brand shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {socio.first_name} {socio.last_name}
                </p>
                <p className="text-xs text-text-secondary truncate">{socio.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSocio(null)}
                className="p-1 text-text-tertiary hover:text-text-primary"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <MagnifyingGlassIcon className="h-4 w-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={socioQuery}
                onChange={(e) => setSocioQuery(e.target.value)}
                placeholder="Buscar socio por nombre o email (dejar vacío = consumidor final)"
                className="form-input pl-9"
              />
              {buscandoSocio && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              )}
              {socioResultados.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg ring-1 ring-black/5 max-h-48 overflow-y-auto">
                  {socioResultados.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => elegirSocio(u)}
                      className="w-full text-left px-3 py-2 hover:bg-bg-surface transition-colors"
                    >
                      <p className="text-sm text-text-primary">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-text-tertiary">{u.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pagos */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-2">Cobro</p>
          <div className="space-y-2">
            {pagos.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={p.method}
                  onChange={(e) => cambiarPago(idx, 'method', e.target.value)}
                  className="form-select flex-1"
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={p.amount}
                  onChange={(e) => cambiarPago(idx, 'amount', e.target.value)}
                  placeholder="0"
                  className="form-input w-28"
                />
                {pagos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => quitarLineaPago(idx)}
                    className="p-1.5 text-text-tertiary hover:text-error"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={agregarLineaPago}
              className="text-sm text-brand font-medium hover:text-brand-hover"
            >
              + Agregar otro método (pago partido)
            </button>
          </div>
        </div>

        <div>
          <label className="form-label">Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-textarea"
            rows={2}
          />
        </div>
      </div>
    </Sidecart>
  )
}
