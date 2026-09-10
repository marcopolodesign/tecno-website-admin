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
import Sidecart from './Sidecart'
import cajaService, { METODOS_PAGO_VENTA, PRECIOS_PLAN } from '../services/cajaService'
import productsService from '../services/productsService'
import membershipPlansService from '../services/membershipPlansService'

// El mostrador: buscar productos/planes, armar el carrito, aplicar descuento, elegir socio
// (o consumidor final) y cobrar — con pago partido en varios medios, o fiado.
//
// Vive en un Sidecart y no en su propia ruta por lo mismo que el resto de lo que se crea en
// el admin: vender es una ACCIÓN de la pantalla Caja, nunca algo que se visita sin un turno
// abierto de fondo.
export default function VenderSidecart({ isOpen, onClose, sedeId, turno, onSold }) {
  const [cargando, setCargando] = useState(false)
  const [productos, setProductos] = useState([])
  const [planes, setPlanes] = useState([])
  const [tab, setTab] = useState('productos')
  const [busqueda, setBusqueda] = useState('')

  const [carrito, setCarrito] = useState([])

  const [socio, setSocio] = useState(null)
  const [socioQuery, setSocioQuery] = useState('')
  const [socioResultados, setSocioResultados] = useState([])
  const [buscandoSocio, setBuscandoSocio] = useState(false)
  const [saldoSocio, setSaldoSocio] = useState(0)

  const [descuentoTipo, setDescuentoTipo] = useState('monto') // 'monto' | 'porcentaje'
  const [descuentoValor, setDescuentoValor] = useState('')
  const [descuentoMotivo, setDescuentoMotivo] = useState('')

  const [pagos, setPagos] = useState([{ medio: 'efectivo', monto: '' }])
  const [notas, setNotas] = useState('')
  const [enviando, setEnviando] = useState(false)

  const resetForm = useCallback(() => {
    setCarrito([])
    setSocio(null)
    setSocioQuery('')
    setSocioResultados([])
    setSaldoSocio(0)
    setDescuentoTipo('monto')
    setDescuentoValor('')
    setDescuentoMotivo('')
    setPagos([{ medio: 'efectivo', monto: '' }])
    setNotas('')
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
    setBuscandoSocio(true)
    const id = setTimeout(async () => {
      try {
        const resultados = await cajaService.buscarSocios(socioQuery)
        setSocioResultados(resultados)
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
    return productos.filter((p) => p.nombre.toLowerCase().includes(q))
  }, [productos, busqueda])

  const planesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return planes
    return planes.filter((p) => p.name.toLowerCase().includes(q))
  }, [planes, busqueda])

  const agregarProducto = (p) => {
    setCarrito((prev) => {
      const existente = prev.find((i) => i.kind === 'producto' && i.productoId === p.id)
      if (existente) {
        return prev.map((i) => (i.key === existente.key ? { ...i, cantidad: i.cantidad + 1 } : i))
      }
      return [
        ...prev,
        {
          key: `producto-${p.id}`,
          kind: 'producto',
          productoId: p.id,
          descripcion: p.nombre,
          precioUnitario: Number(p.precio),
          cantidad: 1,
          llevaStock: p.llevaStock,
          stockActual: p.stockActual,
        },
      ]
    })
  }

  const agregarPlan = (plan) => {
    setCarrito((prev) => [
      ...prev,
      {
        key: `plan-${plan.id}-${Date.now()}`,
        kind: 'plan',
        membershipPlanId: plan.id,
        descripcion: `Membresía ${plan.name}`,
        precioBase: plan,
        precioTipo: 'priceEfectivo',
        precioUnitario: Number(plan.priceEfectivo ?? plan.price),
        cantidad: 1,
        durationMonths: plan.durationMonths,
      },
    ])
  }

  const cambiarPrecioTipo = (key, tipo) => {
    setCarrito((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i
        const precio = i.precioBase[tipo] ?? i.precioBase.price
        return { ...i, precioTipo: tipo, precioUnitario: Number(precio) }
      })
    )
  }

  const cambiarCantidad = (key, next) => {
    if (next < 1) {
      setCarrito((prev) => prev.filter((i) => i.key !== key))
      return
    }
    setCarrito((prev) => prev.map((i) => (i.key === key ? { ...i, cantidad: next } : i)))
  }

  const quitarItem = (key) => setCarrito((prev) => prev.filter((i) => i.key !== key))

  const subtotal = carrito.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0)
  const descuentoMonto = useMemo(() => {
    const v = Number(descuentoValor) || 0
    if (v <= 0) return 0
    return descuentoTipo === 'porcentaje' ? Math.round(subtotal * (v / 100) * 100) / 100 : v
  }, [descuentoTipo, descuentoValor, subtotal])
  const total = Math.max(subtotal - descuentoMonto, 0)

  const cobrado = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0)
  const diferencia = Math.round((total - cobrado) * 100) / 100
  const hayFiado = pagos.some((p) => p.medio === 'cuenta_corriente' && Number(p.monto) > 0)
  const hayPlan = carrito.some((i) => i.kind === 'plan')

  const cambiarPago = (idx, campo, valor) => {
    setPagos((prev) => prev.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)))
  }

  const agregarLineaPago = () => {
    const restante = Math.max(Math.round((total - cobrado) * 100) / 100, 0)
    setPagos((prev) => [...prev, { medio: 'efectivo', monto: restante ? String(restante) : '' }])
  }

  const quitarLineaPago = (idx) => setPagos((prev) => prev.filter((_, i) => i !== idx))

  const elegirSocio = async (u) => {
    setSocio(u)
    setSocioQuery('')
    setSocioResultados([])
    try {
      const saldo = await cajaService.saldoSocio(u.id)
      setSaldoSocio(saldo)
    } catch {
      setSaldoSocio(0)
    }
  }

  const puedeEnviar =
    carrito.length > 0 &&
    !enviando &&
    diferencia === 0 &&
    (!hayPlan || !!socio) &&
    (!hayFiado || !!socio) &&
    (descuentoMonto <= 0 || descuentoMotivo.trim())

  const handleSubmit = async () => {
    if (!carrito.length) return
    if (hayPlan && !socio) {
      toast.error('Elegí un socio antes de cobrar — la membresía necesita a quién asignarse.', toastOptions)
      return
    }
    if (hayFiado && !socio) {
      toast.error('No se puede fiar sin socio — elegí uno o cambiá el medio de pago.', toastOptions)
      return
    }
    if (descuentoMonto > 0 && !descuentoMotivo.trim()) {
      toast.error('El descuento necesita un motivo.', toastOptions)
      return
    }
    if (diferencia !== 0) {
      toast.error(
        diferencia > 0
          ? `Falta cobrar ${formatARS(diferencia)}.`
          : `Se cargó ${formatARS(-diferencia)} de más — ajustá los pagos.`,
        toastOptions
      )
      return
    }

    const pagosValidos = pagos.filter((p) => Number(p.monto) > 0).map((p) => ({ medio: p.medio, monto: Number(p.monto) }))

    setEnviando(true)
    try {
      await cajaService.registrarVenta({
        turnoId: turno.id,
        items: carrito.map((i) => ({
          tipo: i.kind,
          id: i.kind === 'producto' ? i.productoId : i.membershipPlanId,
          cantidad: i.cantidad,
          precio_unitario: i.precioUnitario,
        })),
        pagos: pagosValidos,
        userId: socio?.id || null,
        descuentoMonto,
        descuentoMotivo: descuentoMotivo.trim() || null,
        notas: notas.trim() || null,
      })
      toast.success(`Venta registrada — ${formatARS(total)}`, toastOptions)
      resetForm()
      onSold?.()
      onClose()
    } catch (err) {
      // El motivo ya viene en castellano desde la RPC — se muestra tal cual.
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
      subtitle={turno ? `Turno abierto` : ''}
      size="xl"
      zIndex={60}
      footer={
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Subtotal</span>
            <span className="text-text-primary">{formatARS(subtotal)}</span>
          </div>
          {descuentoMonto > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Descuento</span>
              <span className="text-error">-{formatARS(descuentoMonto)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary font-medium">Total</span>
            <span className="font-semibold text-text-primary">{formatARS(total)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Cobrado</span>
            <span className="font-semibold text-text-primary">{formatARS(cobrado)}</span>
          </div>
          {diferencia > 0.009 && (
            <div className="flex items-center justify-between text-sm rounded-lg bg-warning/10 px-3 py-2">
              <span className="text-warning font-medium">Falta asignar</span>
              <span className="text-warning font-semibold">{formatARS(diferencia)}</span>
            </div>
          )}
          {diferencia < -0.009 && (
            <div className="flex items-center justify-between text-sm rounded-lg bg-error/10 px-3 py-2">
              <span className="text-error font-medium">Sobra asignado</span>
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
                const reponer = p.llevaStock && p.stockActual <= p.stockMinimo
                const sinStock = p.llevaStock && p.stockActual <= 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => agregarProducto(p)}
                    className="text-left p-2.5 rounded-lg bg-bg-surface hover:bg-bg-surface-hover transition-colors"
                  >
                    <p className="text-sm font-medium text-text-primary truncate">{p.nombre}</p>
                    <p className="text-xs text-text-secondary">{formatARS(p.precio)}</p>
                    {p.llevaStock && (
                      <p className={`text-[11px] mt-0.5 ${sinStock ? 'text-error' : reponer ? 'text-warning' : 'text-text-tertiary'}`}>
                        {sinStock ? 'Sin stock' : reponer ? `Reponer — quedan ${p.stockActual}` : `${p.stockActual} en stock`}
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
                  <p className="text-xs text-text-secondary">
                    {formatARS(plan.priceEfectivo ?? plan.price)} · {plan.durationMonths} {plan.durationMonths === 1 ? 'mes' : 'meses'}
                  </p>
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
                <div key={item.key} className="flex items-center gap-2 p-2 rounded-lg bg-bg-surface flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{item.descripcion}</p>
                    {item.kind === 'plan' ? (
                      <select
                        value={item.precioTipo}
                        onChange={(e) => cambiarPrecioTipo(item.key, e.target.value)}
                        className="text-xs text-text-tertiary bg-transparent border-none p-0 mt-0.5 focus:ring-0"
                      >
                        {PRECIOS_PLAN.map((pp) => (
                          <option key={pp.value} value={pp.value}>
                            Precio {pp.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-text-tertiary">{formatARS(item.precioUnitario)} c/u</p>
                    )}
                  </div>
                  {item.kind === 'producto' ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(item.key, item.cantidad - 1)}
                        className="p-1 rounded-md hover:bg-bg-surface-hover text-text-secondary"
                      >
                        <MinusIcon className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm w-5 text-center">{item.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(item.key, item.cantidad + 1)}
                        className="p-1 rounded-md hover:bg-bg-surface-hover text-text-secondary"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-brand font-medium px-2 py-0.5 rounded-full bg-brand/10">Membresía</span>
                  )}
                  <span className="text-sm font-semibold text-text-primary w-20 text-right">
                    {formatARS(item.precioUnitario * item.cantidad)}
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

        {/* Descuento */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-2">Descuento (opcional)</p>
          <div className="flex items-center gap-2 mb-2">
            <select
              value={descuentoTipo}
              onChange={(e) => setDescuentoTipo(e.target.value)}
              className="form-select w-36"
            >
              <option value="monto">Monto ($)</option>
              <option value="porcentaje">Porcentaje (%)</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              value={descuentoValor}
              onChange={(e) => setDescuentoValor(e.target.value)}
              placeholder="0"
              className="form-input flex-1"
            />
          </div>
          {Number(descuentoValor) > 0 && (
            <input
              type="text"
              value={descuentoMotivo}
              onChange={(e) => setDescuentoMotivo(e.target.value)}
              placeholder="Motivo del descuento (obligatorio)"
              className="form-input"
            />
          )}
        </div>

        {/* Socio */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-2">
            Socio{' '}
            {(hayPlan || hayFiado) && (
              <span className="text-error">— obligatorio {hayPlan ? '(hay una membresía en el carrito)' : '(se está fiando)'}</span>
            )}
          </p>
          {socio ? (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-brand/5">
              <UserCircleIcon className="h-8 w-8 text-brand shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {socio.firstName} {socio.lastName}
                </p>
                <p className="text-xs text-text-secondary truncate">{socio.email}</p>
                {saldoSocio > 0 && (
                  <p className="text-xs text-warning font-medium mt-0.5">Ya debe {formatARS(saldoSocio)} en cuenta corriente</p>
                )}
              </div>
              <button type="button" onClick={() => setSocio(null)} className="p-1 text-text-tertiary hover:text-text-primary">
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
                placeholder="Buscar socio por nombre o email (vacío = consumidor final)"
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
                      <p className="text-sm text-text-primary">
                        {u.firstName} {u.lastName}
                      </p>
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
                <select value={p.medio} onChange={(e) => cambiarPago(idx, 'medio', e.target.value)} className="form-select flex-1">
                  {METODOS_PAGO_VENTA.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={p.monto}
                  onChange={(e) => cambiarPago(idx, 'monto', e.target.value)}
                  placeholder="0"
                  className="form-input w-28"
                />
                {pagos.length > 1 && (
                  <button type="button" onClick={() => quitarLineaPago(idx)} className="p-1.5 text-text-tertiary hover:text-error">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={agregarLineaPago} className="text-sm text-brand font-medium hover:text-brand-hover">
              + Agregar otro método (pago partido)
            </button>
          </div>
        </div>

        <div>
          <label className="form-label">Notas (opcional)</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} className="form-textarea" rows={2} />
        </div>
      </div>
    </Sidecart>
  )
}
