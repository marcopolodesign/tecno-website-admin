import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import BenchmarkTooltip from './BenchmarkTooltip'

// Wrapper común a las 6 métricas: título, descripción, benchmark (si hay) y el estado de
// carga/error/vacío resuelto en un solo lugar. Sin barrita de color a la izquierda —
// convención del proyecto — el estado se comunica con texto e íconos, no con un acento.
export default function MetricCard({ title, description, benchmarkLabel, loading, error, isEmpty, emptyLabel, children, footer }) {
  return (
    <div className="card border-0 shadow-none">
      <div className="mb-4">
        <BenchmarkTooltip label={benchmarkLabel}>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        </BenchmarkTooltip>
        {description && <p className="text-xs text-text-tertiary mt-1">{description}</p>}
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-error/5 p-4 flex items-start gap-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-error flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-error">No se pudo cargar esta métrica</p>
            <p className="text-xs text-text-secondary mt-0.5">{error.message}</p>
          </div>
        </div>
      ) : isEmpty ? (
        <div className="h-40 flex flex-col items-center justify-center text-center gap-1">
          <p className="text-sm text-text-secondary">{emptyLabel || 'Sin datos todavía'}</p>
        </div>
      ) : (
        children
      )}

      {footer && !loading && !error && <div className="mt-4">{footer}</div>}
    </div>
  )
}
