import { useState, useEffect, useCallback } from 'react'
import {
  LockOpenIcon,
  LockClosedIcon,
  ShoppingCartIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
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
// registrar ingresos/egresos y disparar la venta (que vive en su propio Sidecart, VenderSidecart).
//
// El cierre pide UN solo número: lo que se contó en efectivo. No se declara nada de tarjeta o
// transferencia porque eso ya lo sabe el sistema (sale_payments) y no hay nada físico que
// pueda faltar en esos métodos — el arqueo es efectivo contado contra efectivo esperado,
// nada más.
export default function Caja({ userRole }) {
  const { sedeId, sede } = useSede()

  const [profile, setProfile] = useState(null)
  const [cajaAbierta, setCajaAbierta] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [ventas, setVentas] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showAbrir, setShowAbrir] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [abriendo, setAbriendo] = useState(false)

  const [showCerrar, setShowCerrar] = useState(false)
  const [countedAmount, setCountedAmount] = useState('')
  const [closingNotes, setClosingNotes] = useState('')
  const [cerrando, setCerrando] = useState(false)

  const [showMovimiento, setShowMovimiento] = useState(false)
  const [movTipo, setMovTipo] = useState('egreso')
  const [movAmount, setMovAmount] = useState('')
  const [movReason, setMovReason] = useState('')
  const [enviandoMov, setEnviandoMov] = useState(false)

  const [showVender, setShowVender] = useState(false)

  const [anulando, setAnulando] = useState(null) // venta seleccionada para anular
  const [anularReason, setAnularReason] = useState('')
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
      const { data: abierta } = await cajaService.getCajaAbierta(sedeId)
      setCajaAbierta(abierta)

      if (abierta) {
        const [res, { data: v }, { data: m }] = await Promise.all([
          cajaService.resumenCaja(abierta.id),
          cajaService.ventasSesion(abierta.id),
          cajaService.movimientosSesion(abierta.id),
        ])
        setResumen(res)
        setVentas(v)
        setMovimientos(m)
      } else {
        setResumen(null)
        setVentas([])
        setMovimientos([])
      }

      const { data: hist } = await cajaService.historialCierres(sedeId)
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
    if (!profile) return
    setAbriendo(true)
    try {
      await cajaService.abrirCaja(sedeId, profile.id, Number(openingAmount) || 0)
      toast.success('Caja abierta', toastOptions)
      setShowAbrir(false)
      setOpeningAmount('')
      cargarTurno()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setAbriendo(false)
    }
  }

  const handleCerrar = async (e) => {
    e.preventDefault()
    if (!profile || !cajaAbierta) return
    setCerrando(true)
    try {
      const cerrada = await cajaService.cerrarCaja(
        cajaAbierta.id,
        profile.id,
        Number(countedAmount) || 0,
        closingNotes.trim() || null
      )
      const diff = Number(cerrada.difference)
      toast.success(
        diff === 0
          ? 'Caja cerrada — sin diferencia'
          : diff > 0
          ? `Caja cerrada — sobran ${formatARS(diff)}`
          : `Caja cerrada — faltan ${formatARS(Math.abs(diff))}`,
        toastOptions
      )
      setShowCerrar(false)
      setCountedAmount('')
      setClosingNotes('')
      cargarTurno()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setCerrando(false)
    }
  }

  const handleMovimiento = async (e) => {
    e.preventDefault()
    if (!profile || !cajaAbierta) return
    if (!movReason.trim()) {
      toast.error('El motivo es obligatorio.', toastOptions)
      return
    }
    setEnviandoMov(true)
    try {
      await cajaService.registrarMovimiento(
        cajaAbierta.id,
        movTipo,
        Number(movAmount),
        movReason.trim(),
        profile.id
      )
      toast.success(movTipo === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado', toastOptions)
      setShowMovimiento(false)
      setMovAmount('')
      setMovReason('')
      cargarTurno()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setEnviandoMov(false)
    }
  }

  // Admin/super_admin anulan cualquier venta. Recepción sólo las de su propio turno, y sólo
  // mientras ese turno sigue abierto — una vez cerrado, anular ya no tiene un arqueo al que
  // volver a cuadrar.
  const puedeAnular = (venta) => {
    if (!venta || venta.status === 'anulada') return false
    if (userRole === 'admin' || userRole === 'super_admin') return true
    if (userRole !== 'front_desk') return false
    return (
      cajaAbierta?.status === 'abierta' &&
      cajaAbierta.openedBy === profile?.id &&
      venta.cashSessionId === cajaAbierta.id
    )
  }

  // Cuánto se cobró EN EFECTIVO en esa venta: es lo único que puede tener que salir
  // físicamente del cajón al anular. Lo de tarjeta se devuelve por el posnet, no de acá.
  const efectivoDeVenta = (venta) =>
    (venta?.salePayments || venta?.sale_payments || [])
      .filter((p) => p.method === 'efectivo')
      .reduce((acc, p) => acc + Number(p.amount || 0), 0)

  const handleAnular = async (e) => {
    e.preventDefault()
    if (!anulando || !profile) return
    if (!anularReason.trim()) {
      toast.error('El motivo es obligatorio.', toastOptions)
      return
    }
    setEnviandoAnular(true)
    try {
      await cajaService.anularVenta(anulando.id, profile.id, anularReason.trim())

      // Anular no saca la plata del cajón por sí solo, y está bien que no lo haga: a veces
      // se anula un error de carga y el billete nunca se movió. Pero cuando SÍ se devuelve,
      // ese egreso hay que anotarlo o el cierre va a marcar un sobrante que no existe.
      // Preguntarlo acá es lo que evita que alguien se entere recién al contar la caja.
      const efectivo = efectivoDeVenta(anulando)
      if (devolverEfectivo && efectivo > 0) {
        await cajaService.registrarMovimiento(
          cajaAbierta.id, 'egreso', efectivo,
          `Devolución por anulación de venta #${anulando.numero}`, profile.id
        )
      }

      toast.success(
        devolverEfectivo && efectivo > 0
          ? `Venta #${anulando.numero} anulada y ${formatARS(efectivo)} devueltos`
          : `Venta #${anulando.numero} anulada`,
        toastOptions
      )
      setAnulando(null)
      setAnularReason('')
      setDevolverEfectivo(true)
      cargarTurno()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setEnviandoAnular(false)
    }
  }

  const puedeOperarCaja = ['super_admin', 'admin', 'front_desk'].includes(userRole)

  if (loading && !cajaAbierta) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Caja</h1>
          <p className="text-sm text-text-secondary mt-1">{sede?.name || 'Sede'}</p>
        </div>
        {cajaAbierta && puedeOperarCaja && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMovimiento(true)} className="btn-secondary">
              Ingreso / Egreso
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

      {!cajaAbierta ? (
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
                Turno abierto por {cajaAbierta.sellers ? `${cajaAbierta.sellers.firstName} ${cajaAbierta.sellers.lastName}` : '—'}
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">
                Desde {new Date(cajaAbierta.openedAt).toLocaleString('es-AR')} · Apertura {formatARS(cajaAbierta.openingAmount)}
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
                <Stat label="Total vendido" value={formatARS(resumen.totalVendido)} sub={`${resumen.ventasCount} venta${resumen.ventasCount === 1 ? '' : 's'}`} />
                <Stat label="Total cobrado" value={formatARS(resumen.totalCobrado)} />
                <Stat label="Fiado pendiente" value={formatARS(resumen.fiadoPendiente)} tone={resumen.fiadoPendiente > 0 ? 'warning' : undefined} />
                <Stat label="Efectivo esperado" value={formatARS(resumen.efectivoEsperado)} tone="brand" />
              </div>

              <div className="card border-0 shadow-none">
                <p className="text-sm font-semibold text-text-primary mb-3">Cobrado por método</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {METODOS_PAGO.map((m) => (
                    <div key={m.value} className="p-2.5 bg-bg-surface rounded-lg text-center">
                      <p className="text-xs text-text-tertiary mb-1">{m.label}</p>
                      <p className="text-sm font-semibold text-text-primary">
                        {formatARS(resumen[`cobrado${m.value[0].toUpperCase()}${m.value.slice(1)}`])}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="p-2.5 bg-success/5 rounded-lg text-center">
                    <p className="text-xs text-text-tertiary mb-1">Ingresos</p>
                    <p className="text-sm font-semibold text-success">{formatARS(resumen.ingresos)}</p>
                  </div>
                  <div className="p-2.5 bg-error/5 rounded-lg text-center">
                    <p className="text-xs text-text-tertiary mb-1">Egresos</p>
                    <p className="text-sm font-semibold text-error">{formatARS(resumen.egresos)}</p>
                  </div>
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
                      <span className="text-text-primary truncate">{m.reason}</span>
                    </div>
                    <span className={`font-medium shrink-0 ${m.tipo === 'ingreso' ? 'text-success' : 'text-error'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{formatARS(m.amount)}
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
                      <th className="table-header">#</th>
                      <th className="table-header">Socio</th>
                      <th className="table-header">Métodos</th>
                      <th className="table-header">Total</th>
                      <th className="table-header">Estado</th>
                      <th className="table-header"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map((v) => (
                      <tr key={v.id} className="table-row">
                        <td className="table-cell">{v.numero}</td>
                        <td className="table-cell">{v.users ? `${v.users.firstName} ${v.users.lastName}` : 'Consumidor final'}</td>
                        <td className="table-cell">
                          {(v.salePayments || []).map((p) => METODOS_PAGO.find((m) => m.value === p.method)?.label || p.method).join(', ') || '—'}
                        </td>
                        <td className="table-cell">{formatARS(v.total)}</td>
                        <td className="table-cell">
                          <span className={`status-badge ${v.status === 'anulada' ? 'status-perdido' : 'status-convertido'}`}>
                            {v.status === 'anulada' ? 'Anulada' : 'Completada'}
                          </span>
                        </td>
                        <td className="table-cell text-right">
                          {puedeAnular(v) && (
                            <button
                              onClick={() => setAnulando(v)}
                              className="text-xs text-error hover:underline"
                            >
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
          <p className="text-sm font-semibold text-text-primary mb-3">Cierres anteriores</p>
          <div className="overflow-x-auto -mx-1.5">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-header">Cierre</th>
                  <th className="table-header">Abrió</th>
                  <th className="table-header">Cerró</th>
                  <th className="table-header">Apertura</th>
                  <th className="table-header">Contado</th>
                  <th className="table-header">Esperado</th>
                  <th className="table-header">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => {
                  const diff = Number(h.difference)
                  return (
                    <tr key={h.id} className="table-row">
                      <td className="table-cell">{new Date(h.closedAt).toLocaleString('es-AR')}</td>
                      <td className="table-cell">{h.abiertaPor ? `${h.abiertaPor.firstName} ${h.abiertaPor.lastName}` : '—'}</td>
                      <td className="table-cell">{h.cerradaPor ? `${h.cerradaPor.firstName} ${h.cerradaPor.lastName}` : '—'}</td>
                      <td className="table-cell">{formatARS(h.openingAmount)}</td>
                      <td className="table-cell">{formatARS(h.countedAmount)}</td>
                      <td className="table-cell">{formatARS(h.expectedAmount)}</td>
                      <td className={`table-cell font-medium ${diff === 0 ? '' : diff > 0 ? 'text-success' : 'text-error'}`}>
                        {diff === 0 ? 'Sin diferencia' : diff > 0 ? `+${formatARS(diff)}` : formatARS(diff)}
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
            <button type="button" onClick={() => setShowAbrir(false)} className="btn-secondary">Cancelar</button>
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
              value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)}
              className="form-input"
              placeholder="0"
              autoFocus
            />
            <p className="text-xs text-text-tertiary mt-1">El cambio con el que arranca el turno.</p>
          </div>
        </form>
      </Sidecart>

      {/* Cerrar caja — arqueo */}
      <Sidecart
        isOpen={showCerrar}
        onClose={() => setShowCerrar(false)}
        title="Cerrar caja"
        subtitle="Arqueo de efectivo"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowCerrar(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleCerrar} disabled={cerrando || !countedAmount} className="btn-primary disabled:opacity-50">
              {cerrando ? 'Cerrando...' : 'Confirmar cierre'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCerrar} className="space-y-4">
          <div>
            <label className="form-label">Efectivo contado *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={countedAmount}
              onChange={(e) => setCountedAmount(e.target.value)}
              className="form-input"
              placeholder="0"
              autoFocus
            />
          </div>

          {resumen && countedAmount !== '' && (
            <DiferenciaPreview esperado={Number(resumen.efectivoEsperado)} contado={Number(countedAmount) || 0} />
          )}

          <div>
            <label className="form-label">Notas (opcional)</label>
            <textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              className="form-textarea"
              rows={2}
            />
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
            <button type="button" onClick={() => setShowMovimiento(false)} className="btn-secondary">Cancelar</button>
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
            <label className="form-label">Monto *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={movAmount}
              onChange={(e) => setMovAmount(e.target.value)}
              className="form-input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="form-label">Motivo *</label>
            <textarea
              required
              value={movReason}
              onChange={(e) => setMovReason(e.target.value)}
              className="form-textarea"
              rows={2}
              placeholder={movTipo === 'ingreso' ? 'Ej: aporte de cambio' : 'Ej: pago a proveedor'}
            />
          </div>
        </form>
      </Sidecart>

      {/* Anular venta */}
      <Sidecart
        isOpen={!!anulando}
        onClose={() => { setAnulando(null); setAnularReason('') }}
        title={`Anular venta #${anulando?.numero || ''}`}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setAnulando(null); setAnularReason('') }} className="btn-secondary">Cancelar</button>
            <button onClick={handleAnular} disabled={enviandoAnular} className="btn-danger disabled:opacity-50">
              {enviandoAnular ? 'Anulando...' : 'Anular venta'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleAnular} className="space-y-4">
          <p className="text-sm text-text-secondary">
            Anular devuelve el stock de los productos de esta venta. No se puede deshacer.
          </p>

          {efectivoDeVenta(anulando) > 0 && (
            <label className="flex items-start gap-2.5 rounded-lg bg-bg-surface p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={devolverEfectivo}
                onChange={(e) => setDevolverEfectivo(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="text-text-primary">
                  Devolví {formatARS(efectivoDeVenta(anulando))} en efectivo
                </span>
                <span className="block text-xs text-text-tertiary mt-0.5">
                  Se anota como egreso del turno. Destildalo si la plata no salió del cajón
                  (por ejemplo, si fue un error de carga).
                </span>
              </span>
            </label>
          )}

          <div>
            <label className="form-label">Motivo *</label>
            <textarea
              required
              value={anularReason}
              onChange={(e) => setAnularReason(e.target.value)}
              className="form-textarea"
              rows={3}
              autoFocus
            />
          </div>
        </form>
      </Sidecart>

      <VenderSidecart
        isOpen={showVender}
        onClose={() => setShowVender(false)}
        sedeId={sedeId}
        sellerId={profile?.id}
        cajaAbierta={cajaAbierta}
        onSold={cargarTurno}
      />
    </div>
  )
}

function Stat({ label, value, sub, tone }) {
  const toneClass = tone === 'warning' ? 'text-warning' : tone === 'brand' ? 'text-brand' : 'text-text-primary'
  return (
    <div className="card border-0 shadow-none">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className={`text-lg font-semibold ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  )
}

function DiferenciaPreview({ esperado, contado }) {
  const diff = contado - esperado
  const tone = diff === 0 ? 'bg-bg-surface text-text-secondary' : diff > 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
  return (
    <div className={`rounded-lg p-3 text-sm ${tone}`}>
      <div className="flex items-center justify-between">
        <span>Esperado</span>
        <span className="font-medium">{formatARS(esperado)}</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span>Diferencia</span>
        <span className="font-semibold">
          {diff === 0 ? 'Sin diferencia' : diff > 0 ? `Sobran ${formatARS(diff)}` : `Faltan ${formatARS(Math.abs(diff))}`}
        </span>
      </div>
    </div>
  )
}
