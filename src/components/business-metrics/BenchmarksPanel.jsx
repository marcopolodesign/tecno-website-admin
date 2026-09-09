import { useEffect, useState } from 'react'
import { CheckIcon, PencilIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import businessMetricsService from '../../services/businessMetricsService'

const UNIT_LABEL = { percent: '%', days: 'días', visits_per_week: 'x/semana' }

// Benchmarks de industria fitness — configurables desde acá, no hardcodeados en el
// código de los charts (mismo criterio que bigg-eye). Editar uno acá cambia en el momento
// la línea de referencia que se ve en el chart correspondiente.
export default function BenchmarksPanel({ onChange }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const fetchBenchmarks = () => {
    setLoading(true)
    setError(null)
    businessMetricsService
      .getBenchmarks()
      .then(setRows)
      .catch(setError)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchBenchmarks() }, [])

  const startEdit = (row) => {
    setEditingId(row.id)
    setDraft(String(row.target_value))
    setSaveError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setSaveError(null)
  }

  const save = async (row) => {
    const value = parseFloat(draft)
    if (Number.isNaN(value)) {
      setSaveError('Tiene que ser un número')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await businessMetricsService.updateBenchmark(row.id, value)
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))
      setEditingId(null)
      onChange?.()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Benchmarks de industria</h3>
        <p className="text-xs text-text-tertiary mt-1">
          Los usa cada métrica de arriba como línea de referencia. Editables — no son fijos en el código.
        </p>
      </div>

      {loading ? (
        <div className="h-24 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-error/5 border border-error/20 p-4 flex items-start gap-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-error flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-error">No se pudieron cargar los benchmarks</p>
            <p className="text-xs text-text-secondary mt-0.5">{error.message}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 py-2 border-b border-border-default last:border-b-0">
              <div className="min-w-0">
                <p className="text-sm text-text-primary truncate">{row.label}</p>
                {row.description && <p className="text-xs text-text-tertiary truncate">{row.description}</p>}
              </div>
              {editingId === row.id ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <input
                    type="number"
                    step="0.1"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="form-input w-20 text-right"
                    autoFocus
                  />
                  <span className="text-xs text-text-tertiary w-16">{UNIT_LABEL[row.unit] || row.unit}</span>
                  <button onClick={() => save(row)} disabled={saving} className="p-1.5 rounded-md hover:bg-success/10 text-success" title="Guardar">
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button onClick={cancelEdit} disabled={saving} className="p-1.5 rounded-md hover:bg-bg-surface text-text-tertiary" title="Cancelar">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => startEdit(row)}
                  className="flex items-center gap-2 flex-shrink-0 px-2.5 py-1 rounded-md hover:bg-bg-surface transition-colors group"
                >
                  <span className="text-sm font-semibold text-text-primary">
                    {row.target_value}{UNIT_LABEL[row.unit] || row.unit}
                  </span>
                  <PencilIcon className="h-3.5 w-3.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          ))}
          {saveError && <p className="text-xs text-error mt-1">{saveError}</p>}
        </div>
      )}
    </div>
  )
}
