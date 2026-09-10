import { useState, useEffect, useCallback } from 'react'
import {
  LockOpenIcon,
  LockClosedIcon,
  ShoppingCartIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'
import { toastOptions } from '../lib/themeStyles'
import { formatARS } from '../lib/dinero'
import { useSede } from '../contexts/SedeContext'
import { authService } from '../services/authService'
import cajaService, { METODOS_PAGO } from '../services/cajaService'
import Sidecart from './Sidecart'
import VenderSidecart from './VenderSidecart'

// La pantalla principal de la caja de mostrador: abrir/cerrar turno, ver el resumen en vivo,
// registrar ingresos/egresos, cobrar cuenta corriente y disparar la venta (que vive en su
// propio Sidecart, VenderSidecart).
//
// El resumen del turno NUNCA muestra ni calcula el efectivo esperado — `caja_resumen_turno`
// directamente no lo trae. Eso se revela sólo como respuesta de `caja_cerrar_turno`, después
// de que quien cierra ya cargó lo que contó a ciegas.
export default function Caja({ userRole }) {
  const { sedeId, sede } = useSede()

  const [profile, setProfile] = useState(null)
  const [turno, setTurno] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [ventas, setVentas] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showAbrir, setShowAbrir] = useState(false)
  const [montoInicial, setMontoInicial] = useState('')
  const [abriendo, setAbriendo] = useState(false)

  const [showCerrar, setShowCerrar] = useState(false)
  const [efectivoContado, setEfectivoContado] = useState('')
  const [notasCierre, setNotasCierre] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [resultadoCierre, setResultadoCierre] = useState(null)

  const [showMovimiento, setShowMovimiento] = useState(false)
  const [movTipo, setMovTipo] = useState('egreso')
  const [movCategoria, setMovCategoria] = useState('')
  const [movDetalle, setMovDetalle] = useState('')
  const [movMonto, setMovMonto] = useState('')
  const [movMedio, setMovMedio] = useState('efectivo')
  const [enviandoMov, setEnviandoMov] = useState(false)

  const [showVender, setShowVender] = useState(false)

  const [showCobrar, setShowCobrar] = useState(false)
  const [cobrarSocio, setCobrarSocio] = useState(null)
  const [cobrarQuery, setCobrarQuery] = useState('')
  const [cobrarResultados, setCobrarResultados] = useState([])
  const [cobrarSaldo, setCobrarSaldo] = useState(0)
  const [cobrarMonto, setCobrarMonto] = useState('')
  const [cobrarMedio, setCobrarMedio] = useState('efectivo')
  const [enviandoCobro, setEnviandoCobro] = useState(false)

  const [anulando, setAnulando] = useState(null)
  const [anularMotivo, setAnularMotivo] = useState('')
  const [devolverEfectivo, setDevolverEfectivo] = useState(true)
  const [enviandoAnular, setEnviandoAnular] = useState(false)

  useEffect(() => {
    authService.getCurrentUserProfile().then(setProfile).catch(() => setProfile(null))
  }, [])

  const cargarTurno = useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    setError(null)
    try {
      const abierta = await cajaService.getTurnoAbierto(sedeId)
      setTurno(abierta)

      if (abierta) {
        const [res, v, m] = await Promise.all([
          cajaService.resumenTurno(abierta.id),
          cajaService.ventasTurno(abierta.id),
          cajaService.movimientosTurno(abierta.id),
        ])
        setResumen(res)
        setVentas(v)
        setMovimientos(m)
      } else {
        setResumen(null)
        setVentas([])
        setMovimientos([])
      }

      const hist = await cajaService.historialTurnos(sedeId)
      setHistorial(hist)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [sedeId])

  useEffect(() => {
    cargarTurno()
  }, [cargarTurno])

  const handleAbrir = async (e) => {
    e.preventDefault()
    setAbriendo(true)
    try {
      await cajaService.abrirTurno(sedeId, Number(montoInicial) || 0)
      toast.success('Caja abierta', toastOptions)
      setShowAbrir(false)
      setMontoInicial('')
      setResultadoCierre(null)
      cargarTurno()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setAbriendo(false)
    }
  }

  const handleCerrar = async (e) => {
    e.preventDefault()
    if (!turno) return
    setCerrando(true)
    try {
      const cerrado = await cajaService.cerrarTurno(turno.id, efectivoContado, notasCierre.trim() || null)
      const diff = Number(cerrado.diferencia)
      setResultadoCierre(cerrado)
      toast.success(
        Math.abs(diff) < 0.01
          ? 'Caja cerrada — sin diferencia'
          : diff > 0
          ? `Caja cerrada — sobran ${formatARS(diff)}`
          : `Caja cerrada — faltan ${formatARS(Math.abs(diff))}`,
        toastOptions
      )
      setShowCerrar(false)
      setEfectivoContado('')
      setNotasCierre('')
      cargarTurno()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setCerrando(false)
    }
  }

  const handleMovimiento = async (e) => {
    e.preventDefault()
    if (!turno) return
    if (!movCategoria.trim()) {
      toast.error('La categoría es obligatoria.', toastOptions)
      return
    }
    setEnviandoMov(true)
    try {
      await cajaService.registrarMovimiento({
        turnoId: turno.id,
        tipo: movTipo,
        categoria: movCategoria.trim(),
        detalle: movDetalle.trim() || null,
        monto: movMonto,
        medioPago: movMedio,
        creadoPor: profile?.id,
      })
      toast.success(movTipo === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado', toastOptions)
      setShowMovimiento(false)
      setMovCategoria('')
      setMovDetalle('')
      setMovMonto('')
      setMovMedio('efectivo')
      cargarTurno()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setEnviandoMov(false)
    }
  }

  // Cobrar cuenta corriente — mismo debounce simple que el buscador de socio de VenderSidecart.
  useEffect(() => {
    if (!showCobrar || !cobrarQuery || cobrarQuery.trim().length < 2) {
      setCobrarResultados([])
      return
    }
    const id = setTimeout(async () => {
      try {
        const resultados = await cajaService.buscarSocios(cobrarQuery)
        setCobrarResultados(resultados)
      } catch (err) {
        toast.error(err.message, toastOptions)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [showCobrar, cobrarQuery])

  const elegirCobrarSocio = async (u) => {
    setCobrarSocio(u)
    setCobrarQuery('')
    setCobrarResultados([])
    try {
      const saldo = await cajaService.saldoSocio(u.id)
      setCobrarSaldo(saldo)
      setCobrarMonto(saldo > 0 ? String(saldo) : '')
    } catch {
      setCobrarSaldo(0)
    }
  }

  const cerrarCobrarSidecart = () => {
    setShowCobrar(false)
    setCobrarSocio(null)
    setCobrarQuery('')
    setCobrarResultados([])
    setCobrarSaldo(0)
    setCobrarMonto('')
    setCobrarMedio('efectivo')
  }

  const handleCobrar = async (e) => {
    e.preventDefault()
    if (!turno || !cobrarSocio) return
    setEnviandoCobro(true)
    try {
      await cajaService.cobrarCuenta(turno.id, cobrarSocio.id, cobrarMonto, cobrarMedio)
      toast.success(`Cobro registrado — ${formatARS(cobrarMonto)}`, toastOptions)
      cerrarCobrarSidecart()
      cargarTurno()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setEnviandoCobro(false)
    }
  }

  const puedeAnular = (venta) => venta.estado !== 'anulada' && puedeOperarCaja

  // Cuánto se cobró EN EFECTIVO en esa venta — es lo único que puede tener que seguir en el
  // cajón si la anulación fue por un error de carga. Lo de tarjeta/transferencia/MP no se
  // devuelve del cajón, así que ahí el checkbox no aplica.
  const efectivoDeVenta = (venta) =>
    (venta?.cajaVentaPagos || [])
      .filter((p) => p.medioPago === 'efectivo')
      .reduce((acc, p) => acc + Number(p.monto || 0), 0)

  const abrirAnular = (venta) => {
    setAnulando(venta)
    setAnularMotivo('')
    setDevolverEfectivo(true)
  }

  const handleAnular = async (e) => {
    e.preventDefault()
    if (!anulando) return
    if (!anularMotivo.trim()) {
      toast.error('El motivo es obligatorio.', toastOptions)
      return
    }
    setEnviandoAnular(true)
    try {
      await cajaService.anularVenta(anulando.id, anularMotivo.trim(), devolverEfectivo)
      toast.success('Venta anulada', toastOptions)
      setAnulando(null)
      setAnularMotivo('')
      cargarTurno()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setEnviandoAnular(false)
    }
  }

  const puedeOperarCaja = ['super_admin', 'admin', 'front_desk'].includes(userRole)

  const descripcionVenta = (v) => (v.cajaVentaItems || []).map((i) => i.descripcion).join(', ') || '—'
  const mediosVenta = (v) =>
    (v.cajaVentaPagos || [])
      .map((p) => METODOS_PAGO.concat([{ value: 'cuenta_corriente', label: 'Fiado' }]).find((m) => m.value === p.medioPago)?.label || p.medioPago)
      .join(', ') || '—'

  if (loading && !turno) {
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
          <h1 className="text-xl font-semibold text-text-primary">Caja</h1>
          <p className="text-sm text-text-secondary mt-1">{sede?.name || 'Sede'}</p>
        </div>
        {turno && puedeOperarCaja && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowMovimiento(true)} className="btn-secondary">
              Ingreso / Egreso
            </button>
            <button onClick={() => setShowCobrar(true)} className="btn-secondary">
              Cobrar cuenta corriente
            </button>
            <button onClick={() => setShowVender(true)} className="btn-primary flex items-center gap-2">
              <ShoppingCartIcon className="h-4 w-4" />
              Vender
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-error/5 p-4 flex items-start gap-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-error flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-error">No se pudo cargar la caja</p>
            <p className="text-xs text-text-secondary mt-0.5">{error.message}</p>
          </div>
        </div>
      )}

      {resultadoCierre && !turno && (
        <div className="card border-0 shadow-none">
          <p className="text-sm font-semibold text-text-primary mb-3">Resultado del último cierre</p>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Contado" value={formatARS(resultadoCierre.efectivoContado)} />
            <Stat label="Esperado" value={formatARS(resultadoCierre.efectivoEsperado)} />
            <Stat
              label="Diferencia"
              value={
                Math.abs(Number(resultadoCierre.diferencia)) < 0.01
                  ? 'Sin diferencia'
                  : Number(resultadoCierre.diferencia) > 0
                  ? `+${formatARS(resultadoCierre.diferencia)}`
                  : formatARS(resultadoCierre.diferencia)
              }
              tone={Math.abs(Number(resultadoCierre.diferencia)) < 0.01 ? undefined : Number(resultadoCierre.diferencia) > 0 ? 'success' : 'warning'}
            />
          </div>
        </div>
      )}

      {!turno ? (
        <div className="card border-0 shadow-none text-center py-12">
          <BanknotesIcon className="h-10 w-10 text-text-tertiary mx-auto mb-3" />
          <p className="text-text-primary font-medium">No hay una caja abierta en esta sede</p>
          <p className="text-sm text-text-secondary mt-1 mb-4">Abrila para empezar a vender y cobrar</p>
          {puedeOperarCaja && (
            <button onClick={() => setShowAbrir(true)} className="btn-primary inline-flex items-center gap-2">
              <LockOpenIcon className="h-4 w-4" />
              Abrir caja
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="card border-0 shadow-none flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Turno abierto por {turno.abiertoPorSeller ? `${turno.abiertoPorSeller.firstName} ${turno.abiertoPorSeller.lastName}` : '—'}
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">
                Desde {new Date(turno.abiertoAt).toLocaleString('es-AR')} · Apertura {formatARS(turno.montoInicial)}
              </p>
            </div>
            {puedeOperarCaja && (
              <button onClick={() => setShowCerrar(true)} className="btn-secondary flex items-center gap-2">
                <LockClosedIcon className="h-4 w-4" />
                Cerrar caja
              </button>
            )}
          </div>

          {resumen && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat
                  label="Total vendido"
                  value={formatARS(resumen.totalVendido)}
                  sub={`${resumen.ventasCount} venta${Number(resumen.ventasCount) === 1 ? '' : 's'}`}
                />
                <Stat label="Descuentos" value={formatARS(resumen.descuentos)} />
                <Stat label="Fiado del turno" value={formatARS(resumen.fiado)} tone={Number(resumen.fiado) > 0 ? 'warning' : undefined} />
                <Stat label="Ingresos / egresos" value={`${formatARS(resumen.ingresosExtra)} / ${formatARS(resumen.egresos)}`} />
              </div>

              <div className="card border-0 shadow-none">
                <p className="text-sm font-semibold text-text-primary mb-3">Cobrado por método</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {METODOS_PAGO.map((m) => (
                    <div key={m.value} className="p-2.5 bg-bg-surface rounded-lg text-center">
                      <p className="text-xs text-text-tertiary mb-1">{m.label}</p>
                      <p className="text-sm font-semibold text-text-primary">{formatARS(resumen[m.value])}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {movimientos.length > 0 && (
            <div className="card border-0 shadow-none">
              <p className="text-sm font-semibold text-text-primary mb-3">Ingresos y egresos del turno</p>
              <div className="space-y-1.5">
                {movimientos.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {m.tipo === 'ingreso' ? (
                        <ArrowDownTrayIcon className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <ArrowUpTrayIcon className="h-4 w-4 text-error shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="text-text-primary truncate block">{m.categoria}</span>
                        {m.detalle && <span className="text-xs text-text-tertiary truncate block">{m.detalle}</span>}
                      </div>
                    </div>
                    <span className={`font-medium shrink-0 ${m.tipo === 'ingreso' ? 'text-success' : 'text-error'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}
                      {formatARS(m.monto)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card border-0 shadow-none">
            <p className="text-sm font-semibold text-text-primary mb-3">Ventas del turno</p>
            {ventas.length === 0 ? (
              <p className="text-sm text-text-tertiary text-center py-6">Todavía no hay ventas</p>
            ) : (
              <div className="overflow-x-auto -mx-1.5">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Hora</th>
                      <th className="table-header">Qué se vendió</th>
                      <th className="table-header">Socio</th>
                      <th className="table-header">Medios</th>
                      <th className="table-header">Total</th>
                      <th className="table-header">Estado</th>
                      <th className="table-header"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map((v) => (
                      <tr key={v.id} className="table-row">
                        <td className="table-cell">{new Date(v.createdAt).toLocaleTimeString('es-AR')}</td>
                        <td className={`table-cell ${v.estado === 'anulada' ? 'line-through text-text-tertiary' : ''}`}>{descripcionVenta(v)}</td>
                        <td className="table-cell">{v.socio ? `${v.socio.firstName} ${v.socio.lastName}` : 'Consumidor final'}</td>
                        <td className="table-cell">{mediosVenta(v)}</td>
                        <td className={`table-cell ${v.estado === 'anulada' ? 'line-through text-text-tertiary' : ''}`}>{formatARS(v.total)}</td>
                        <td className="table-cell">
                          <span className={`status-badge ${v.estado === 'anulada' ? 'status-perdido' : 'status-convertido'}`}>
                            {v.estado === 'anulada' ? 'Anulada' : 'Completada'}
                          </span>
                        </td>
                        <td className="table-cell text-right">
                          {puedeAnular(v) && (
                            <button onClick={() => abrirAnular(v)} className="text-xs text-error hover:underline">
                              Anular
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {historial.length > 0 && (
        <div className="card border-0 shadow-none">
          <p className="text-sm font-semibold text-text-primary mb-3">Turnos anteriores</p>
          <div className="overflow-x-auto -mx-1.5">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-header">Fecha</th>
                  <th className="table-header">Abrió</th>
                  <th className="table-header">Cerró</th>
                  <th className="table-header">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => {
                  const diff = Number(h.diferencia)
                  return (
                    <tr key={h.id} className="table-row">
                      <td className="table-cell">{new Date(h.cerradoAt).toLocaleString('es-AR')}</td>
                      <td className="table-cell">{h.abiertoPorSeller ? `${h.abiertoPorSeller.firstName} ${h.abiertoPorSeller.lastName}` : '—'}</td>
                      <td className="table-cell">{h.cerradoPorSeller ? `${h.cerradoPorSeller.firstName} ${h.cerradoPorSeller.lastName}` : '—'}</td>
                      <td className={`table-cell font-medium ${Math.abs(diff) < 0.01 ? '' : diff > 0 ? 'text-success' : 'text-error'}`}>
                        {Math.abs(diff) < 0.01 ? 'Sin diferencia' : diff > 0 ? `+${formatARS(diff)}` : formatARS(diff)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Abrir caja */}
      <Sidecart
        isOpen={showAbrir}
        onClose={() => setShowAbrir(false)}
        title="Abrir caja"
        subtitle={sede?.name}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowAbrir(false)} className="btn-secondary">
              Cancelar
            </button>
            <button onClick={handleAbrir} disabled={abriendo} className="btn-primary disabled:opacity-50">
              {abriendo ? 'Abriendo...' : 'Abrir caja'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleAbrir} className="space-y-4">
          <div>
            <label className="form-label">Monto inicial</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={montoInicial}
              onChange={(e) => setMontoInicial(e.target.value)}
              className="form-input"
              placeholder="0"
              autoFocus
            />
            <p className="text-xs text-text-tertiary mt-1">El cambio con el que arranca el turno.</p>
          </div>
        </form>
      </Sidecart>

      {/* Cerrar caja — arqueo a ciegas: NO se muestra el esperado hasta confirmar. */}
      <Sidecart
        isOpen={showCerrar}
        onClose={() => setShowCerrar(false)}
        title="Cerrar caja"
        subtitle="Arqueo de efectivo"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowCerrar(false)} className="btn-secondary">
              Cancelar
            </button>
            <button onClick={handleCerrar} disabled={cerrando || efectivoContado === ''} className="btn-primary disabled:opacity-50">
              {cerrando ? 'Cerrando...' : 'Confirmar cierre'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCerrar} className="space-y-4">
          <p className="text-sm text-text-secondary">
            Contá el efectivo del cajón y cargá el número. El sistema recién te va a mostrar si coincide después de confirmar.
          </p>
          <div>
            <label className="form-label">Efectivo contado *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={efectivoContado}
              onChange={(e) => setEfectivoContado(e.target.value)}
              className="form-input"
              placeholder="0"
              autoFocus
            />
          </div>
          <div>
            <label className="form-label">Notas (opcional)</label>
            <textarea value={notasCierre} onChange={(e) => setNotasCierre(e.target.value)} className="form-textarea" rows={2} />
          </div>
        </form>
      </Sidecart>

      {/* Ingreso / egreso */}
      <Sidecart
        isOpen={showMovimiento}
        onClose={() => setShowMovimiento(false)}
        title="Ingreso / egreso"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowMovimiento(false)} className="btn-secondary">
              Cancelar
            </button>
            <button onClick={handleMovimiento} disabled={enviandoMov} className="btn-primary disabled:opacity-50">
              {enviandoMov ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleMovimiento} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMovTipo('ingreso')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                movTipo === 'ingreso' ? 'bg-success/15 text-success' : 'bg-bg-surface text-text-secondary'
              }`}
            >
              Ingreso
            </button>
            <button
              type="button"
              onClick={() => setMovTipo('egreso')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                movTipo === 'egreso' ? 'bg-error/15 text-error' : 'bg-bg-surface text-text-secondary'
              }`}
            >
              Egreso
            </button>
          </div>
          <div>
            <label className="form-label">Categoría *</label>
            <input
              type="text"
              required
              value={movCategoria}
              onChange={(e) => setMovCategoria(e.target.value)}
              className="form-input"
              placeholder={movTipo === 'ingreso' ? 'Ej: aporte de cambio' : 'Ej: retiro, proveedor, gasto'}
            />
          </div>
          <div>
            <label className="form-label">Detalle (opcional)</label>
            <textarea value={movDetalle} onChange={(e) => setMovDetalle(e.target.value)} className="form-textarea" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Monto *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={movMonto}
                onChange={(e) => setMovMonto(e.target.value)}
                className="form-input"
                placeholder="0"
              />
            </div>
            <div>
              <label className="form-label">Medio</label>
              <select value={movMedio} onChange={(e) => setMovMedio(e.target.value)} className="form-select">
                {METODOS_PAGO.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Sidecart>

      {/* Cobrar cuenta corriente */}
      <Sidecart
        isOpen={showCobrar}
        onClose={cerrarCobrarSidecart}
        title="Cobrar cuenta corriente"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={cerrarCobrarSidecart} className="btn-secondary">
              Cancelar
            </button>
            <button onClick={handleCobrar} disabled={enviandoCobro || !cobrarSocio || !cobrarMonto} className="btn-primary disabled:opacity-50">
              {enviandoCobro ? 'Cobrando...' : 'Registrar cobro'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCobrar} className="space-y-4">
          <div>
            <label className="form-label">Socio</label>
            {cobrarSocio ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-brand/5">
                <UserCircleIcon className="h-8 w-8 text-brand shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {cobrarSocio.firstName} {cobrarSocio.lastName}
                  </p>
                  <p className="text-xs text-text-secondary truncate">{cobrarSocio.email}</p>
                </div>
                <button type="button" onClick={() => setCobrarSocio(null)} className="p-1 text-text-tertiary hover:text-text-primary">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <MagnifyingGlassIcon className="h-4 w-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={cobrarQuery}
                  onChange={(e) => setCobrarQuery(e.target.value)}
                  placeholder="Buscar por nombre o email"
                  className="form-input pl-9"
                  autoFocus
                />
                {cobrarResultados.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg ring-1 ring-black/5 max-h-48 overflow-y-auto">
                    {cobrarResultados.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => elegirCobrarSocio(u)}
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

          {cobrarSocio && (
            <>
              <div className="rounded-lg bg-bg-surface p-3 text-sm flex items-center justify-between">
                <span className="text-text-secondary">Saldo actual</span>
                <span className={`font-semibold ${cobrarSaldo > 0 ? 'text-warning' : 'text-text-primary'}`}>{formatARS(cobrarSaldo)}</span>
              </div>
              {cobrarSaldo <= 0 && <p className="text-xs text-text-tertiary">Este socio no tiene saldo pendiente.</p>}
              <div>
                <label className="form-label">Monto a cobrar *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={cobrarMonto}
                  onChange={(e) => setCobrarMonto(e.target.value)}
                  className="form-input"
                  placeholder="0"
                />
                <p className="text-xs text-text-tertiary mt-1">Puede ser total o parcial.</p>
              </div>
              <div>
                <label className="form-label">Medio</label>
                <select value={cobrarMedio} onChange={(e) => setCobrarMedio(e.target.value)} className="form-select">
                  {METODOS_PAGO.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </form>
      </Sidecart>

      {/* Anular venta */}
      <Sidecart
        isOpen={!!anulando}
        onClose={() => {
          setAnulando(null)
          setAnularMotivo('')
        }}
        title="Anular venta"
        subtitle={anulando ? formatARS(anulando.total) : ''}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setAnulando(null)
                setAnularMotivo('')
              }}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button onClick={handleAnular} disabled={enviandoAnular} className="btn-danger disabled:opacity-50">
              {enviandoAnular ? 'Anulando...' : 'Anular venta'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleAnular} className="space-y-4">
          <p className="text-sm text-text-secondary">
            Anular devuelve el stock de los productos de esta venta y, si estaba fiada, cancela la deuda. No se puede deshacer.
          </p>

          {efectivoDeVenta(anulando) > 0 && (
            <label className="flex items-start gap-2.5 rounded-lg bg-bg-surface p-3 cursor-pointer">
              <input type="checkbox" checked={devolverEfectivo} onChange={(e) => setDevolverEfectivo(e.target.checked)} className="mt-0.5" />
              <span className="text-sm">
                <span className="text-text-primary">Devolví {formatARS(efectivoDeVenta(anulando))} en efectivo al cliente</span>
                <span className="block text-xs text-text-tertiary mt-0.5">
                  Destildalo si fue un error de carga y la plata nunca salió del cajón — el cierre lo compensa solo.
                </span>
              </span>
            </label>
          )}

          <div>
            <label className="form-label">Motivo *</label>
            <textarea required value={anularMotivo} onChange={(e) => setAnularMotivo(e.target.value)} className="form-textarea" rows={3} autoFocus />
          </div>
        </form>
      </Sidecart>

      <VenderSidecart isOpen={showVender} onClose={() => setShowVender(false)} sedeId={sedeId} turno={turno} onSold={cargarTurno} />
    </div>
  )
}

function Stat({ label, value, sub, tone }) {
  const toneClass = tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : tone === 'brand' ? 'text-brand' : 'text-text-primary'
  return (
    <div className="card border-0 shadow-none">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className={`text-lg font-semibold ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  )
}
