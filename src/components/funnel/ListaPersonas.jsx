const FORMATO_FECHA = { day: '2-digit', month: '2-digit', year: '2-digit' }

// El estado del lead viene en inglés del enum de la base; acá se lee en español.
const ESTADO_LEAD = {
  new: 'Nuevo',
  contacted: 'Contactado',
  qualified: 'Calificado',
  negotiating: 'Negociando',
  converted: 'Convertido',
  lost: 'Perdido',
}

function fecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', FORMATO_FECHA)
}

export default function ListaPersonas({
  etapa,
  etiqueta,
  personas,
  total,
  loading,
  error,
  soloEstancados,
  onToggleEstancados,
  onVerMas,
  hayMas,
}) {
  if (!etapa) {
    return (
      <div className="card border-0 shadow-none flex h-40 items-center justify-center text-center">
        <p className="text-sm text-text-secondary">
          Tocá una etapa del embudo para ver quiénes están ahí.
        </p>
      </div>
    )
  }

  return (
    <div className="card border-0 shadow-none">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            {soloEstancados ? `Se quedaron en ${etiqueta}` : `Llegaron a ${etiqueta}`}
          </h3>
          <p className="mt-0.5 text-xs text-text-tertiary">
            {soloEstancados
              ? 'Los que no avanzaron de esta etapa — a quiénes hay que llamar.'
              : 'Todos los que pasaron por acá, incluidos los que siguieron avanzando.'}
          </p>
        </div>

        {/* Dos preguntas distintas sobre la misma etapa: cuánta gente pasó (lo que dice la
            barra) y quién quedó trabado (lo accionable). El toggle evita tener que elegir. */}
        <button
          type="button"
          onClick={onToggleEstancados}
          className={
            soloEstancados
              ? 'status-badge bg-brand/10 text-brand'
              : 'status-badge bg-bg-surface text-text-secondary hover:bg-bg-surface-hover transition-colors'
          }
        >
          Sólo los que se quedaron
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-error/5 p-4">
          <p className="text-sm font-medium text-error">No se pudo cargar esta lista</p>
          <p className="mt-0.5 text-xs text-text-secondary">{error.message}</p>
        </div>
      ) : !personas.length ? (
        <div className="flex h-32 items-center justify-center text-center">
          <p className="text-sm text-text-secondary">
            {soloEstancados
              ? 'Nadie quedó trabado en esta etapa en el período elegido.'
              : 'Todavía no llegó nadie a esta etapa en el período elegido.'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-tertiary">
                  <th className="px-3 py-2 font-medium">Persona</th>
                  <th className="px-3 py-2 font-medium">Entró</th>
                  <th className="px-3 py-2 font-medium">Vendedor</th>
                  <th className="px-3 py-2 font-medium">Coach</th>
                  <th className="px-3 py-2 font-medium">Origen</th>
                </tr>
              </thead>
              <tbody>
                {personas.map((p) => (
                  <tr key={p.persona_id} className="align-top">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-text-primary">{p.nombre || 'Sin nombre'}</p>
                        {p.estado_lead && (
                          <span className="status-badge bg-bg-surface text-text-secondary">
                            {ESTADO_LEAD[p.estado_lead] ?? p.estado_lead}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-tertiary">{p.email || p.telefono || '—'}</p>
                    </td>
                    <td className="px-3 py-2.5 text-text-secondary">{fecha(p.entro_at)}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{p.vendedor || '—'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{p.coach || '—'}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{p.utm_source || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-text-tertiary">
            <span>
              Mostrando {personas.length} de {total}
            </span>
            {hayMas && (
              <button type="button" onClick={onVerMas} className="btn-secondary px-3 py-1 text-xs">
                Ver más
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
