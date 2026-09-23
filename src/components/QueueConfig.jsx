import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, TvIcon } from '@heroicons/react/24/outline'
import { queueService, boxLabel } from '../services/queueService'
import { locationsService } from '../services/locationsService'
import { explicacionSegDeLinea, estacionSegDeLinea, DEFAULT_DEMO_ESTACION_SEG } from '../lib/tvClock'
import { mmss } from '../lib/formatos'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import Modal from './Modal'

function LineBoxes({ line, onChanged }) {
  const [boxes, setBoxes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingBox, setEditingBox] = useState(null)
  const [formData, setFormData] = useState({ name: '', box_number: '', line_position: '' })

  const fetchBoxes = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await queueService.getBoxesForLine(line.id)
      setBoxes(data || [])
    } catch (err) {
      toast.error('Error al cargar boxes')
    } finally {
      setLoading(false)
    }
  }, [line.id])

  useEffect(() => {
    fetchBoxes()
  }, [fetchBoxes])

  const openNewModal = () => {
    setEditingBox(null)
    setFormData({
      name: `Box ${boxes.length + 1}`,
      box_number: '',
      line_position: boxes.length + 1,
    })
    setShowModal(true)
  }

  const openEditModal = (box) => {
    setEditingBox(box)
    setFormData({ name: box.name, box_number: box.box_number, line_position: box.line_position })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        name: formData.name,
        box_number: Number(formData.box_number),
        line_position: Number(formData.line_position),
        production_line_id: line.id,
        location_id: line.location_id,
      }
      if (editingBox) {
        await queueService.updateBox(editingBox.id, payload)
        toast.success('Box actualizado')
      } else {
        await queueService.createBox(payload)
        toast.success('Box creado')
      }
      setShowModal(false)
      await fetchBoxes()
      onChanged?.()
    } catch (err) {
      toast.error('Error al guardar box — revisá que el número de box y la posición sean únicos')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este box?')) return
    try {
      await queueService.deleteBox(id)
      toast.success('Box eliminado')
      await fetchBoxes()
      onChanged?.()
    } catch (err) {
      toast.error('Error al eliminar box')
    }
  }

  return (
    <div className="mt-3 pl-4 border-l-2 border-border-default space-y-2">
      {loading ? (
        <p className="text-xs text-text-tertiary">Cargando boxes...</p>
      ) : boxes.length === 0 ? (
        <p className="text-xs text-text-tertiary">Sin boxes en esta línea.</p>
      ) : (
        boxes.map((box) => (
          <div key={box.id} className="flex items-center justify-between text-sm py-1">
            <span className="text-text-primary">
              #{box.line_position} — {box.name} (global box {box.box_number})
            </span>
            <div className="flex items-center gap-2">
              <a
                href={`/lista-espera/tv/${line.id}/estacion/${box.line_position}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-text-tertiary hover:text-brand"
                title={`Abrir la TV de este box (${boxLabel(line.line_number, box.line_position)})`}
              >
                <TvIcon className="h-4 w-4" /> TV
              </a>
              <button onClick={() => openEditModal(box)} className="text-text-tertiary hover:text-brand">
                <PencilIcon className="h-4 w-4" />
              </button>
              <button onClick={() => handleDelete(box.id)} className="text-text-tertiary hover:text-red-500">
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))
      )}

      <button onClick={openNewModal} className="text-xs text-brand flex items-center gap-1 mt-1">
        <PlusIcon className="h-3.5 w-3.5" /> Agregar box
      </button>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingBox ? 'Editar Box' : 'Nuevo Box'}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button onClick={handleSubmit} className="btn-primary">
              Guardar
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
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Número de box (global, único) *</label>
            <input
              type="number"
              required
              value={formData.box_number}
              onChange={(e) => setFormData({ ...formData, box_number: e.target.value })}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Posición en la línea *</label>
            <input
              type="number"
              required
              min="1"
              value={formData.line_position}
              onChange={(e) => setFormData({ ...formData, line_position: e.target.value })}
              className="form-input"
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default function QueueConfig() {
  const [locations, setLocations] = useState([])
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLine, setEditingLine] = useState(null)
  const [formData, setFormData] = useState({ name: '', line_number: '', capacity: 5, location_id: '' })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: locs }, { data: linesData }] = await Promise.all([
        locationsService.getLocations(),
        queueService.getLines(),
      ])
      setLocations(locs || [])
      setLines(linesData || [])
    } catch (err) {
      toast.error('Error al cargar configuración')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const openNewModal = () => {
    setEditingLine(null)
    setFormData({
      name: `Línea ${lines.length + 1}`,
      line_number: lines.length + 1,
      capacity: 5,
      location_id: locations[0]?.id || '',
    })
    setShowModal(true)
  }

  const openEditModal = (line) => {
    setEditingLine(line)
    setFormData({
      name: line.name,
      line_number: line.line_number,
      capacity: line.capacity,
      location_id: line.location_id,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        name: formData.name,
        line_number: Number(formData.line_number),
        capacity: Number(formData.capacity),
        location_id: formData.location_id,
      }
      if (editingLine) {
        await queueService.updateLine(editingLine.id, payload)
        toast.success('Línea actualizada')
      } else {
        await queueService.createLine(payload)
        toast.success('Línea creada')
      }
      setShowModal(false)
      await fetchAll()
    } catch (err) {
      toast.error('Error al guardar línea')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta línea y sus boxes?')) return
    try {
      await queueService.deleteLine(id)
      toast.success('Línea eliminada')
      await fetchAll()
    } catch (err) {
      toast.error('Error al eliminar línea')
    }
  }

  // El demo se prende/apaga por SEDE, no por línea — todas las líneas de una ubicación corren
  // la misma demo al mismo tiempo, así que tocar una sola dejaría a la otra desincronizada.
  const handleToggleDemo = async (locationId, valorActual) => {
    const nuevo = !valorActual
    const lineasSede = lines.filter((l) => l.location_id === locationId)
    try {
      await Promise.all(lineasSede.map((l) => queueService.updateLine(l.id, { modo_demo: nuevo })))
      toast.success(
        nuevo
          ? 'Modo demo activado — la estación dura 1 minuto'
          : 'Modo demo desactivado — la estación vuelve a su duración real'
      )
      await fetchAll()
    } catch (err) {
      toast.error('Error al cambiar el modo demo')
    }
  }

  // Deja la sede lista para mostrar: socios de demo entrenando en las estaciones 2 a 5 y
  // otros esperando. Sólo existe en staging (función demo_cargar_escena) y exige el modo demo.
  const handleCargarEscena = async (locationId) => {
    try {
      const { data, error } = await supabase.rpc('demo_cargar_escena', { p_location_id: locationId, p_en_espera: 8 })
      if (error) throw error
      toast.success(`Escena cargada — ${data?.en_estaciones ?? 0} entrenando, ${data?.esperando ?? 0} esperando`)
      await fetchAll()
    } catch (err) {
      toast.error(err?.message || 'No se pudo cargar la escena de demo')
    }
  }

  if (loading) {
    return <div className="p-6 text-text-secondary">Cargando...</div>
  }

  // Agrupadas por sede: el toggle de demo y el link a la TV de sede son por ubicación, no por
  // línea.
  const lineasPorSede = lines.reduce((acc, l) => {
    const key = l.location_id || 'sin-sede'
    ;(acc[key] = acc[key] || []).push(l)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Configuración — Lista de Espera</h1>
          <p className="text-sm text-text-secondary mt-0.5">Líneas y boxes por sede</p>
        </div>
        <button onClick={openNewModal} className="btn-primary flex items-center gap-2 text-sm">
          <PlusIcon className="h-4 w-4" /> Nueva Línea
        </button>
      </div>

      {lines.length === 0 ? (
        <div className="card text-center py-16 text-text-secondary text-sm">
          No hay líneas configuradas todavía.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(lineasPorSede).map(([locationId, lineasSede]) => {
            const primera = lineasSede[0]
            const nombreSede = primera?.locations?.name || 'Sin sede'
            const modoDemo = Boolean(primera?.modo_demo)
            const explicSeg = explicacionSegDeLinea(primera)
            const estacionSegActual = estacionSegDeLinea(primera)

            return (
              <div key={locationId} className="space-y-3">
                <div className="card flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">{nombreSede}</h2>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      Explicación {mmss(explicSeg)} + Estación {mmss(estacionSegActual)}
                      {modoDemo ? ` (demo — normal ${mmss(estacionSegDeLinea({ ...primera, modo_demo: false }))})` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {locationId !== 'sin-sede' && (
                      <a
                        href={`/lista-espera/tv/sede/${locationId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-brand"
                      >
                        <TvIcon className="h-4 w-4" /> TV de sede
                      </a>
                    )}
                    <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
                      <span>Modo demo — la estación dura {mmss(DEFAULT_DEMO_ESTACION_SEG)}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={modoDemo}
                        onClick={() => handleToggleDemo(locationId, modoDemo)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          modoDemo ? 'bg-brand' : 'bg-border-default'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            modoDemo ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                    {modoDemo && (
                      <button
                        type="button"
                        onClick={() => handleCargarEscena(locationId)}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        Cargar escena de demo
                      </button>
                    )}
                  </div>
                </div>
                {/* Cambiar el toggle sólo afecta a los boxes que entren de acá en más — el
                    servidor ya calculó `advances_at` con la duración vieja para quien está
                    entrenando ahora mismo. */}
                <p className="text-[11px] text-text-tertiary px-1 -mt-2">
                  Cambiar esto no acorta ni alarga a quien ya está entrenando — sólo afecta a quien entra después.
                </p>

                {lineasSede.map((line) => (
                  <div key={line.id} className="card">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-text-primary">{line.name}</h2>
                        <p className="text-xs text-text-tertiary">
                          {line.locations?.name || 'Sin sede'} · Capacidad {line.capacity}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <a
                          href={`/lista-espera/tv/${line.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-brand"
                        >
                          <TvIcon className="h-4 w-4" /> TV de línea
                        </a>
                        <button onClick={() => openEditModal(line)} className="text-text-tertiary hover:text-brand">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(line.id)} className="text-text-tertiary hover:text-red-500">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <LineBoxes line={line} onChanged={fetchAll} />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingLine ? 'Editar Línea' : 'Nueva Línea'}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button onClick={handleSubmit} className="btn-primary">
              Guardar
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Sede *</label>
            <select
              required
              value={formData.location_id}
              onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
              className="form-input"
            >
              <option value="">Seleccionar...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Nombre *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Número de línea *</label>
            <input
              type="number"
              required
              value={formData.line_number}
              onChange={(e) => setFormData({ ...formData, line_number: e.target.value })}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Capacidad (boxes)</label>
            <input
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              className="form-input"
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
