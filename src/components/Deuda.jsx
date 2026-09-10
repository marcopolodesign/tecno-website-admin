import { useState, useEffect, useCallback } from 'react'
import { UserCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'
import { toastOptions } from '../lib/themeStyles'
import { formatARS } from '../lib/dinero'
import { useSede } from '../contexts/SedeContext'
import cajaService, { METODOS_PAGO } from '../services/cajaService'
import Sidecart from './Sidecart'

// Socios con saldo pendiente y el cobro contra la caja de HOY.
//
// La deuda es un libro por socio, no una lista de ventas impagas: un socio puede fiar tres
// veces y pagar una parte suelta que no corresponde a ninguna venta en particular. Por eso
// se cobra contra el saldo y no contra un ticket — y por eso vale la pena poder abrir el
// detalle y ver de dónde salió cada peso.
//
// Cobrar necesita una caja abierta, porque el cobro entra al turno como ingreso: si no
// entrara, el arqueo de esa noche cerraría con un sobrante sin explicación. Es la misma
// regla que impone `caja_cobrar_cuenta` del lado de la base, así que cuando no hay turno
// abierto el botón no aparece en vez de dejar tocar algo que la base va a rechazar.
export default function Deuda() {
  const { sedeId, sede } = useSede()

  const [turno, setTurno] = useState(null)
  const [deudores, setDeudores] = useState([])
  const [loading, setLoading] = useState(true)

  const [cobrando, setCobrando] = useState(null)
  const [movimientos, setMovimientos] = useState([])
  const [metodo, setMetodo] = useState('efectivo')
  const [monto, setMonto] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    if (!sedeId) return
    setLoading(true)
    try {
      const [abierto, lista] = await Promise.all([
        cajaService.getTurnoAbierto(sedeId),
        cajaService.deudores(sedeId),
      ])
      setTurno(abierto)
      setDeudores(lista)
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setLoading(false)
    }
  }, [sedeId])

  useEffect(() => { cargar() }, [cargar])

  const abrirCobro = async (deudor) => {
    setCobrando(deudor)
    setMetodo('efectivo')
    setMonto(String(deudor.saldo))
    setMovimientos([])
    try {
      setMovimientos(await cajaService.movimientosCuenta(deudor.userId))
    } catch (err) {
      toast.error(err.message, toastOptions)
    }
  }

  const handleCobrar = async (e) => {
    e.preventDefault()
    if (!cobrando || !turno) return
    setEnviando(true)
    try {
      await cajaService.cobrarCuenta(turno.id, cobrando.userId, Number(monto), metodo)
      toast.success(`Cobro registrado — ${formatARS(monto)}`, toastOptions)
      setCobrando(null)
      cargar()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setEnviando(false)
    }
  }

  const totalDeuda = deudores.reduce((acc, d) => acc + Number(d.saldo || 0), 0)

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
        <p className="text-sm text-text-secondary mt-1">
          {sede?.name || 'Sede'} — socios con saldo pendiente en cuenta corriente
        </p>
      </div>

      {!turno && deudores.length > 0 && (
        <div className="rounded-lg bg-warning/5 p-4 flex items-start gap-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">
            No hay caja abierta en esta sede — hay que abrirla en <strong>Caja</strong> antes de poder cobrar.
          </p>
        </div>
      )}

      {deudores.length === 0 ? (
        <div className="card border-0 shadow-none text-center py-12">
          <p className="text-text-secondary">Nadie debe nada en esta sede</p>
        </div>
      ) : (
        <>
          <div className="card border-0 shadow-none">
            <p className="text-xs text-text-tertiary mb-1">Deuda total</p>
            <p className="text-lg font-semibold text-warning">{formatARS(totalDeuda)}</p>
          </div>

          <div className="card border-0 shadow-none divide-y divide-border-default">
            {deudores.map((d) => (
              <div key={d.userId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserCircleIcon className="h-8 w-8 text-text-tertiary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{d.nombre || 'Socio'}</p>
                    <p className="text-xs text-text-tertiary truncate">{d.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-sm font-semibold text-warning">{formatARS(d.saldo)}</span>
                  {turno && (
                    <button
                      onClick={() => abrirCobro(d)}
                      className="text-xs text-brand font-medium hover:underline"
                    >
                      Cobrar
                    </button>
                  )}
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
        subtitle={cobrando ? `${cobrando.nombre} — debe ${formatARS(cobrando.saldo)}` : ''}
        size="md"
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
              max={cobrando?.saldo}
              required
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="form-input"
              autoFocus
            />
            {/* Se puede cobrar una parte: viene con el total puesto porque es lo normal,
                pero un pago parcial es igual de válido y deja el resto como saldo. */}
            <p className="text-xs text-text-tertiary mt-1">
              Debe {formatARS(cobrando?.saldo || 0)} — se puede cobrar una parte.
            </p>
          </div>

          {movimientos.length > 0 && (
            <div>
              <p className="form-label">De dónde viene</p>
              <div className="space-y-1">
                {movimientos.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-bg-surface">
                    <span className="text-text-secondary">
                      {new Date(m.createdAt).toLocaleDateString('es-AR')} · {m.detalle || (m.tipo === 'cargo' ? 'Fiado' : 'Pago')}
                    </span>
                    <span className={m.tipo === 'cargo' ? 'text-warning' : 'text-green-600'}>
                      {m.tipo === 'cargo' ? '+' : '−'}{formatARS(m.monto)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </Sidecart>
    </div>
  )
}
