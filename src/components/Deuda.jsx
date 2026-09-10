import { useState, useEffect, useCallback } from 'react'
import { UserCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'
import { toastOptions } from '../lib/themeStyles'
import { formatARS } from '../lib/dinero'
import { useSede } from '../contexts/SedeContext'
import { authService } from '../services/authService'
import cajaService, { METODOS_PAGO } from '../services/cajaService'
import Sidecart from './Sidecart'

// Socios con saldo pendiente (ventas fiadas por caja) y el cobro contra la caja de HOY. El
// cobro necesita una caja abierta en la sede — es la misma regla que registrar_cobro impone
// del lado de la base, así que si no hay turno abierto el botón directamente no aparece en
// vez de dejar tocar algo que la RPC va a rechazar.
export default function Deuda() {
  const { sedeId, sede } = useSede()

  const [profile, setProfile] = useState(null)
  const [cajaAbierta, setCajaAbierta] = useState(null)
  const [deudores, setDeudores] = useState([])
  const [loading, setLoading] = useState(true)

  const [cobrando, setCobrando] = useState(null) // { deudor, venta }
  const [metodo, setMetodo] = useState('efectivo')
  const [monto, setMonto] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    authService.getCurrentUserProfile().then(setProfile).catch(() => setProfile(null))
  }, [])

  const cargar = useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    try {
      const [{ data: abierta }, { data: deuda }] = await Promise.all([
        cajaService.getCajaAbierta(sedeId),
        cajaService.deudoresSede(sedeId),
      ])
      setCajaAbierta(abierta)
      setDeudores(deuda)
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setLoading(false)
    }
  }, [sedeId])

  useEffect(() => { cargar() }, [cargar])

  const abrirCobro = (deudor, venta) => {
    setCobrando({ deudor, venta })
    setMetodo('efectivo')
    setMonto(String(venta.pendiente))
  }

  const handleCobrar = async (e) => {
    e.preventDefault()
    if (!cobrando || !profile || !cajaAbierta) return
    setEnviando(true)
    try {
      await cajaService.registrarCobro(cobrando.venta.id, sedeId, profile.id, metodo, Number(monto))
      toast.success(`Cobro registrado — ${formatARS(monto)}`, toastOptions)
      setCobrando(null)
      cargar()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setEnviando(false)
    }
  }

  const totalDeuda = deudores.reduce((acc, d) => acc + d.saldo, 0)

  if (loading && deudores.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <div>
        <h1 className="text-xl font-semibold text-text-primary">Deuda</h1>
        <p className="text-sm text-text-secondary mt-1">{sede?.name || 'Sede'} — socios con ventas fiadas por caja</p>
      </div>

      {!cajaAbierta && deudores.length > 0 && (
        <div className="rounded-lg bg-warning/5 p-4 flex items-start gap-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">
            No hay caja abierta en esta sede — hay que abrirla en <strong>Caja</strong> antes de poder cobrar.
          </p>
        </div>
      )}

      {deudores.length === 0 ? (
        <div className="card border-0 shadow-none text-center py-12">
          <p className="text-text-secondary">No hay deuda pendiente en esta sede</p>
        </div>
      ) : (
        <>
          <div className="card border-0 shadow-none">
            <p className="text-xs text-text-tertiary mb-1">Deuda total</p>
            <p className="text-lg font-semibold text-warning">{formatARS(totalDeuda)}</p>
          </div>

          <div className="space-y-3">
            {deudores.map((d) => (
              <div key={d.userId} className="card border-0 shadow-none">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserCircleIcon className="h-8 w-8 text-text-tertiary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {d.user?.firstName} {d.user?.lastName}
                      </p>
                      <p className="text-xs text-text-tertiary truncate">{d.user?.email}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-warning shrink-0">{formatARS(d.saldo)}</span>
                </div>

                <div className="space-y-1.5">
                  {d.ventas.map((v) => (
                    <div key={v.id} className="flex items-center justify-between text-sm py-1.5 px-2.5 bg-bg-surface rounded-lg">
                      <div>
                        <span className="text-text-primary">Venta #{v.numero}</span>
                        <span className="text-text-tertiary ml-2">{new Date(v.createdAt).toLocaleDateString('es-AR')}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-text-secondary">{formatARS(v.pendiente)} pendiente</span>
                        {cajaAbierta && (
                          <button
                            onClick={() => abrirCobro(d, v)}
                            className="text-xs text-brand font-medium hover:text-brand-hover"
                          >
                            Cobrar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Sidecart
        isOpen={!!cobrando}
        onClose={() => setCobrando(null)}
        title="Cobrar deuda"
        subtitle={cobrando ? `${cobrando.deudor.user?.firstName} ${cobrando.deudor.user?.lastName} — Venta #${cobrando.venta.numero}` : ''}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setCobrando(null)} className="btn-secondary">Cancelar</button>
            <button onClick={handleCobrar} disabled={enviando} className="btn-primary disabled:opacity-50">
              {enviando ? 'Cobrando...' : 'Registrar cobro'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleCobrar} className="space-y-4">
          <div>
            <label className="form-label">Método</label>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="form-select">
              {METODOS_PAGO.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Monto *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={cobrando?.venta.pendiente}
              required
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="form-input"
              autoFocus
            />
            <p className="text-xs text-text-tertiary mt-1">
              Pendiente: {formatARS(cobrando?.venta.pendiente)}
            </p>
          </div>
        </form>
      </Sidecart>
    </div>
  )
}
