import { useState, useEffect } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'
import arquetiposService from '../services/arquetiposService'
import { FORMATOS } from '../lib/formatos'
import { toastOptions } from '../lib/themeStyles'
import Sidecart from './Sidecart'

// Tipos de socio con una rutina de ejemplo ya escrita, para no empezar cada rutina de cero. El
// coach copia la plantilla del arquetipo (botón "Partir de un arquetipo" en Rutinas) y el motor
// usa sus techos (complejidad, intensidad, formatos preferidos) para no ofrecerle a alguien que
// arranca lo más técnico del catálogo.
//
// La plantilla no es un modelo aparte: es una rutina común marcada is_template + arquetipo_id.
// Se arma y se edita con el editor de Rutinas de siempre — acá sólo se elige cuál rutina cumple
// ese rol.

const VACIO = {
  nombre: '',
  descripcion: '',
  complejidad_max: '',
  intensidad_max: '',
  formatos_preferidos: [],
  orden: 0,
  is_active: true
}

export default function Arquetipos() {
  const [arquetipos, setArquetipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [saving, setSaving] = useState(false)

  const [plantilla, setPlantilla] = useState(null)
  const [loadingPlantilla, setLoadingPlantilla] = useState(false)
  const [buscandoRutina, setBuscandoRutina] = useState(false)
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState([])

  useEffect(() => {
    fetchArquetipos()
  }, [])

  const fetchArquetipos = async () => {
    try {
      setLoading(true)
      const { data } = await arquetiposService.getArquetipos()
      setArquetipos(data || [])
    } catch (error) {
      toast.error('Error al cargar arquetipos', toastOptions)
    } finally {
      setLoading(false)
    }
  }

  const fetchPlantilla = async (arquetipoId) => {
    setLoadingPlantilla(true)
    try {
      const { data } = await arquetiposService.getPlantilla(arquetipoId)
      setPlantilla(data || null)
    } catch (error) {
      toast.error('Error al buscar la plantilla', toastOptions)
    } finally {
      setLoadingPlantilla(false)
    }
  }

  const abrirNuevo = () => {
    setEditingItem(null)
    setForm(VACIO)
    setPlantilla(null)
    setBuscandoRutina(false)
    setQ('')
    setResultados([])
    setShowModal(true)
  }

  const abrirEditar = (item) => {
    setEditingItem(item)
    setForm({
      nombre: item.nombre || '',
      descripcion: item.descripcion || '',
      complejidad_max: item.complejidad_max ?? '',
      intensidad_max: item.intensidad_max ?? '',
      formatos_preferidos: item.formatos_preferidos || [],
      orden: item.orden ?? 0,
      is_active: item.is_active ?? true
    })
    setBuscandoRutina(false)
    setQ('')
    setResultados([])
    setShowModal(true)
    fetchPlantilla(item.id)
  }

  const toggleFormato = (f) => {
    setForm((prev) => ({
      ...prev,
      formatos_preferidos: prev.formatos_preferidos.includes(f)
        ? prev.formatos_preferidos.filter((x) => x !== f)
        : [...prev.formatos_preferidos, f]
    }))
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) {
      toast.error('El nombre es obligatorio', toastOptions)
      return
    }
    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      complejidad_max: form.complejidad_max === '' ? null : Number(form.complejidad_max),
      intensidad_max: form.intensidad_max === '' ? null : Number(form.intensidad_max),
      formatos_preferidos: form.formatos_preferidos,
      orden: Number(form.orden) || 0,
      is_active: form.is_active
    }
    try {
      setSaving(true)
      if (editingItem) {
        await arquetiposService.updateArquetipo(editingItem.id, payload)
        toast.success('Arquetipo actualizado', toastOptions)
      } else {
        await arquetiposService.createArquetipo(payload)
        toast.success('Arquetipo creado', toastOptions)
      }
      setShowModal(false)
      fetchArquetipos()
    } catch (error) {
      toast.error(error?.message || String(error), toastOptions)
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este arquetipo? Los socios que lo tengan asignado quedan sin arquetipo.')) return
    try {
      await arquetiposService.deleteArquetipo(id)
      toast.success('Arquetipo eliminado', toastOptions)
      fetchArquetipos()
    } catch (error) {
      toast.error(error?.message || String(error), toastOptions)
    }
  }

  const buscarRutinas = async (texto) => {
    setQ(texto)
    try {
      const { data } = await arquetiposService.buscarRutinas(texto)
      setResultados(data || [])
    } catch (error) {
      toast.error('Error al buscar rutinas', toastOptions)
    }
  }

  const elegirPlantilla = async (routineId) => {
    try {
      await arquetiposService.setPlantilla(editingItem.id, routineId)
      toast.success('Plantilla asignada', toastOptions)
      setBuscandoRutina(false)
      fetchPlantilla(editingItem.id)
    } catch (error) {
      toast.error(error?.message || String(error), toastOptions)
    }
  }

  const quitarPlantilla = async () => {
    if (!plantilla) return
    try {
      await arquetiposService.quitarPlantilla(plantilla.id)
      toast.success('Plantilla desasignada', toastOptions)
      setPlantilla(null)
    } catch (error) {
      toast.error(error?.message || String(error), toastOptions)
    }
  }

  return (
    <div className="p-6">
      <Toaster />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Arquetipos</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Tipos de socio con una rutina de ejemplo — el punto de partida antes que el motor complete el mes.
          </p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary">
          <PlusIcon className="h-4 w-4" />
          Nuevo arquetipo
        </button>
      </div>

      {loading ? (
        <p className="text-text-tertiary text-sm">Cargando…</p>
      ) : arquetipos.length === 0 ? (
        <p className="text-text-tertiary text-sm">Todavía no hay arquetipos cargados.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {arquetipos.map((a) => (
            <div key={a.id} className={`card ${!a.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-text-primary">{a.nombre}</h3>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => abrirEditar(a)} className="p-1 text-text-tertiary hover:text-brand">
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button onClick={() => eliminar(a.id)} className="p-1 text-text-tertiary hover:text-error">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {a.descripcion && <p className="text-sm text-text-secondary mt-1">{a.descripcion}</p>}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {a.complejidad_max && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-bg-surface text-text-secondary">
                    Complejidad ≤ {a.complejidad_max}
                  </span>
                )}
                {a.intensidad_max && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-bg-surface text-text-secondary">
                    Intensidad ≤ {a.intensidad_max}
                  </span>
                )}
                {(a.formatos_preferidos || []).map((f) => (
                  <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium">
                    {f}
                  </span>
                ))}
                {!a.is_active && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactivo</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Sidecart
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? 'Editar arquetipo' : 'Nuevo arquetipo'}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" form="form-arquetipo" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        }
      >
        <form id="form-arquetipo" onSubmit={guardar} className="space-y-4">
          <div>
            <label className="form-label">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="form-input"
              placeholder="El que arranca"
              required
            />
          </div>
          <div>
            <label className="form-label">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="form-textarea"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Complejidad máxima</label>
              <select
                value={form.complejidad_max}
                onChange={(e) => setForm({ ...form, complejidad_max: e.target.value })}
                className="form-select"
              >
                <option value="">Sin techo</option>
                <option value="1">1 — básico</option>
                <option value="2">2 — intermedio</option>
                <option value="3">3 — avanzado</option>
              </select>
            </div>
            <div>
              <label className="form-label">Intensidad máxima</label>
              <select
                value={form.intensidad_max}
                onChange={(e) => setForm({ ...form, intensidad_max: e.target.value })}
                className="form-select"
              >
                <option value="">Sin techo</option>
                <option value="1">1 — suave</option>
                <option value="2">2 — moderada</option>
                <option value="3">3 — alta</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Modalidades preferidas</label>
            <p className="text-xs text-text-tertiary mb-2">
              En el orden en que se marcan. Vacío = todas por igual.
            </p>
            <div className="flex flex-wrap gap-2">
              {FORMATOS.map((f) => {
                const activo = form.formatos_preferidos.includes(f)
                const posicion = form.formatos_preferidos.indexOf(f)
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFormato(f)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium ${
                      activo ? 'bg-brand text-white border-brand' : 'bg-white text-text-secondary border-border-default'
                    }`}
                  >
                    {activo ? `${posicion + 1}. ` : ''}
                    {f}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Orden</label>
              <input
                type="number"
                value={form.orden}
                onChange={(e) => setForm({ ...form, orden: e.target.value })}
                className="form-input"
                min="0"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Activo
              </label>
            </div>
          </div>

          {editingItem && (
            <div className="pt-4 border-t border-border-default">
              <label className="form-label">Rutina de ejemplo (plantilla)</label>
              {loadingPlantilla ? (
                <p className="text-xs text-text-tertiary">Buscando…</p>
              ) : plantilla ? (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border-default bg-bg-surface/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{plantilla.title}</p>
                    <p className="text-xs text-text-tertiary truncate">
                      {plantilla.users ? `${plantilla.users.first_name} ${plantilla.users.last_name}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={quitarPlantilla} className="text-xs text-error hover:underline flex-shrink-0">
                    Quitar
                  </button>
                </div>
              ) : (
                <p className="text-xs text-text-tertiary mb-2">Todavía no tiene una rutina de ejemplo asignada.</p>
              )}

              {!buscandoRutina ? (
                <button
                  type="button"
                  onClick={() => setBuscandoRutina(true)}
                  className="mt-2 text-xs text-brand hover:underline flex items-center gap-1"
                >
                  <MagnifyingGlassIcon className="h-3.5 w-3.5" />
                  {plantilla ? 'Cambiar rutina' : 'Elegir una rutina existente'}
                </button>
              ) : (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => buscarRutinas(e.target.value)}
                      placeholder="Buscar rutina por título…"
                      className="form-input flex-1"
                      autoFocus
                    />
                    <button type="button" onClick={() => setBuscandoRutina(false)} className="p-1 text-text-tertiary">
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                    {resultados.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => elegirPlantilla(r.id)}
                        className="w-full text-left p-2 rounded-lg hover:bg-bg-surface text-xs"
                      >
                        <p className="font-medium text-text-primary">{r.title}</p>
                        <p className="text-text-tertiary">
                          {r.users ? `${r.users.first_name} ${r.users.last_name}` : ''}
                          {r.is_template && r.arquetipo_id && r.arquetipo_id !== editingItem.id && ' · ya es plantilla de otro arquetipo'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-[11px] text-text-tertiary mt-2">
                Se arma y se edita como cualquier rutina, desde Rutinas — acá sólo se elige cuál cumple este rol.
              </p>
            </div>
          )}
        </form>
      </Sidecart>
    </div>
  )
}
