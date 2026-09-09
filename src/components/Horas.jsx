import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, ArrowPathIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'
import { toastOptions } from '../lib/themeStyles'
import { useSede } from '../contexts/SedeContext'
import horariosService, { DIAS } from '../services/horariosService'
import { coachesService } from '../services/coachesService'
import { sellersService } from '../services/sellersService'
import Sidecart from './Sidecart'

// Horas de coaches y vendedores.
//
// No es una pantalla de RRHH: existe para que el sistema sepa QUIÉN estaba trabajando cuando un
// socio entró, y pueda asignárselo solo. Hasta ahora eso se cargaba a mano socio por socio, que
// es un dato que nadie mantiene.
//
// Manda la primera clase y después no se toca (si el coach se moviera con cada visita, la
// retención por coach no se podría comparar entre meses). Cuando alguien entrena casi siempre
// con otro, aparece abajo como sugerencia — se avisa, no se corrige a escondidas.

const FRANJA_VACIA = { diaSemana: 1, horaInicio: '07:00', horaFin: '10:00', coachIds: [], sellerIds: [] }

function hhmm(hora) {
  return (hora || '').slice(0, 5)
}

export default function Horas() {
  const { sedeId, sede } = useSede()
  const [franjas, setFranjas] = useState([])
  const [coaches, setCoaches] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [sugerencias, setSugerencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(null) // { id? , ...FRANJA_VACIA }
  const [guardando, setGuardando] = useState(false)
  const [recalculando, setRecalculando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [f, c, v] = await Promise.all([
        horariosService.getFranjas(sedeId),
        coachesService.getCoaches(),
        sellersService.getSellers(),
      ])
      setFranjas(f)
      setCoaches((c.data || []).filter((x) => x.isActive ?? x.is_active ?? true))
      setVendedores((v.data || v || []).filter((x) => x.active ?? true))
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [sedeId])

  // Las sugerencias se cargan aparte: recorren todo el historial de ingresos y son lo más lento
  // de la pantalla. Si tardan o fallan, el horario ya se puede editar igual.
  const cargarSugerencias = useCallback(async () => {
    try {
      setSugerencias(await horariosService.getSugerencias(sedeId))
    } catch (err) {
      console.error('Error cargando sugerencias:', err)
    }
  }, [sedeId])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { cargarSugerencias() }, [cargarSugerencias])

  const abrirNueva = (diaSemana) => setEditando({ ...FRANJA_VACIA, diaSemana })

  const abrirEdicion = (f) => setEditando({
    id: f.id,
    diaSemana: f.dia_semana,
    horaInicio: hhmm(f.hora_inicio),
    horaFin: hhmm(f.hora_fin),
    coachIds: (f.franja_coaches || []).map((x) => x.coach_id),
    sellerIds: (f.franja_vendedores || []).map((x) => x.seller_id),
  })

  const guardar = async () => {
    if (editando.horaFin <= editando.horaInicio) {
      toast.error('La franja tiene que terminar después de empezar', toastOptions)
      return
    }
    if (!editando.coachIds.length && !editando.sellerIds.length) {
      toast.error('Poné al menos un coach o un vendedor: si no, la franja no asigna a nadie', toastOptions)
      return
    }
    setGuardando(true)
    try {
      if (editando.id) {
        await horariosService.actualizarFranja(editando.id, editando)
      } else {
        await horariosService.crearFranja({ ...editando, sedeId })
      }
      setEditando(null)
      await cargar()
      toast.success('Horario guardado', toastOptions)
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (f) => {
    try {
      await horariosService.borrarFranja(f.id)
      await cargar()
      toast.success('Franja eliminada', toastOptions)
    } catch (err) {
      toast.error(err.message, toastOptions)
    }
  }

  // Mueve socios que ya existen, así que va con confirmación y diciendo exactamente qué hace.
  const recalcular = async (pisando) => {
    const texto = pisando
      ? 'Esto reasigna TODOS los socios según su primera asistencia, incluidos los que ya tienen coach cargado a mano. ¿Seguimos?'
      : 'Esto completa el coach y el vendedor de los socios que no tienen ninguno. No toca a los que ya tienen. ¿Seguimos?'
    if (!window.confirm(texto)) return
    setRecalculando(true)
    try {
      const r = await horariosService.recalcular(sedeId, { soloSinAsignar: !pisando })
      toast.success(
        `${r.socios_actualizados} socios actualizados` +
        (r.socios_sin_franja > 0 ? ` · ${r.socios_sin_franja} entraron a una hora sin franja cargada` : ''),
        toastOptions,
      )
      await cargarSugerencias()
    } catch (err) {
      toast.error(err.message, toastOptions)
    } finally {
      setRecalculando(false)
    }
  }

  const aceptarSugerencia = async (s) => {
    try {
      await horariosService.reasignarCoach(s.user_id, s.coach_sugerido_id)
      setSugerencias((prev) => prev.filter((x) => x.user_id !== s.user_id))
      toast.success(`${s.socio} pasó a ${s.coach_sugerido}`, toastOptions)
    } catch (err) {
      toast.error(err.message, toastOptions)
    }
  }

  const toggle = (campo, id) => setEditando((prev) => ({
    ...prev,
    [campo]: prev[campo].includes(id) ? prev[campo].filter((x) => x !== id) : [...prev[campo], id],
  }))

  const franjasDe = (dia) => franjas.filter((f) => f.dia_semana === dia)

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Horas</h1>
          <p className="text-sm text-text-secondary mt-1">
            {sede ? sede.name : 'Todas las sedes'} · quién trabaja en cada turno. Es lo que decide a qué coach y a qué
            vendedor queda un socio cuando entra.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => recalcular(false)}
            disabled={recalculando}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${recalculando ? 'animate-spin' : ''}`} />
            Completar los que no tienen
          </button>
          <button
            onClick={() => recalcular(true)}
            disabled={recalculando}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            Recalcular todos
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-error/5 p-4">
          <p className="text-sm font-medium text-error">No se pudo cargar el horario</p>
          <p className="text-xs text-text-secondary mt-0.5">{error.message}</p>
        </div>
      )}

      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {DIAS.map((dia) => (
            <div key={dia.id} className="card border-0 shadow-none">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-text-primary">{dia.nombre}</h2>
                <button
                  onClick={() => abrirNueva(dia.id)}
                  className="text-sm text-brand hover:underline flex items-center gap-1"
                >
                  <PlusIcon className="h-4 w-4" /> Agregar franja
                </button>
              </div>

              {franjasDe(dia.id).length === 0 ? (
                <p className="text-sm text-text-tertiary py-3">
                  Sin franjas. Los socios que entren este día quedan sin asignar.
                </p>
              ) : (
                <div className="space-y-2">
                  {franjasDe(dia.id).map((f) => (
                    <div key={f.id} className="px-3 py-2.5 rounded-md bg-bg-surface">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-text-primary">
                          {hhmm(f.hora_inicio)} – {hhmm(f.hora_fin)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => abrirEdicion(f)} title="Editar"
                            className="p-1 text-text-tertiary hover:text-brand rounded transition-colors">
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button onClick={() => borrar(f)} title="Eliminar"
                            className="p-1 text-text-tertiary hover:text-error rounded transition-colors">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(f.franja_coaches || []).map((c) => (
                          <span key={c.coach_id} className="status-badge bg-brand/10 text-brand">
                            {c.coaches?.first_name} {c.coaches?.last_name}
                          </span>
                        ))}
                        {(f.franja_vendedores || []).map((v) => (
                          <span key={v.seller_id} className="status-badge bg-bg-secondary text-text-secondary">
                            {v.sellers?.first_name} {v.sellers?.last_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* El aviso que pidió Mateo: manda la primera clase, pero si entrena casi siempre con
          otro conviene saberlo. La decisión sigue siendo de una persona. */}
      {sugerencias.length > 0 && (
        <div className="card border-0 shadow-none">
          <h2 className="text-sm font-semibold text-text-primary">Socios que entrenan con otro coach</h2>
          <p className="text-xs text-text-tertiary mt-1 mb-3">
            Quedaron con el coach de su primera clase, pero vienen más seguido en el turno de otro.
          </p>
          <div className="space-y-1">
            {sugerencias.map((s) => (
              <div key={s.user_id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-bg-surface">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{s.socio}</p>
                  <p className="text-xs text-text-tertiary">
                    {s.coach_asignado} ({s.veces_con_asignado} de {s.total_ingresos})
                    <ArrowRightIcon className="h-3 w-3 inline mx-1" />
                    {s.coach_sugerido} ({s.veces_con_sugerido})
                  </p>
                </div>
                <button onClick={() => aceptarSugerencia(s)} className="btn-secondary text-sm whitespace-nowrap">
                  Reasignar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sidecart
        isOpen={Boolean(editando)}
        onClose={() => setEditando(null)}
        title={editando?.id ? 'Editar franja' : 'Nueva franja'}
        subtitle={editando ? DIAS.find((d) => d.id === editando.diaSemana)?.nombre : undefined}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditando(null)} className="btn-secondary">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="btn-primary disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        }
      >
        {editando && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Día</label>
              <select
                value={editando.diaSemana}
                onChange={(e) => setEditando({ ...editando, diaSemana: Number(e.target.value) })}
                className="input-field w-full"
              >
                {DIAS.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Desde</label>
                <input type="time" value={editando.horaInicio} className="input-field w-full"
                  onChange={(e) => setEditando({ ...editando, horaInicio: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Hasta</label>
                <input type="time" value={editando.horaFin} className="input-field w-full"
                  onChange={(e) => setEditando({ ...editando, horaFin: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Coaches del turno</label>
              <p className="text-xs text-text-tertiary mb-2">
                Pueden ser varios. Los socios que entren en esta franja se reparten parejo entre ellos, y cada socio
                cae siempre en el mismo.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {coaches.map((c) => (
                  <button key={c.id} type="button" onClick={() => toggle('coachIds', c.id)}
                    className={editando.coachIds.includes(c.id)
                      ? 'status-badge bg-brand/10 text-brand'
                      : 'status-badge bg-bg-surface text-text-secondary hover:bg-bg-surface-hover transition-colors'}>
                    {c.firstName ?? c.first_name} {c.lastName ?? c.last_name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Recepción del turno</label>
              <div className="flex flex-wrap gap-1.5">
                {vendedores.map((v) => (
                  <button key={v.id} type="button" onClick={() => toggle('sellerIds', v.id)}
                    className={editando.sellerIds.includes(v.id)
                      ? 'status-badge bg-brand/10 text-brand'
                      : 'status-badge bg-bg-surface text-text-secondary hover:bg-bg-surface-hover transition-colors'}>
                    {v.firstName ?? v.first_name} {v.lastName ?? v.last_name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Sidecart>
    </div>
  )
}
