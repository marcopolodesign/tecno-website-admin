import { useState, useEffect, useCallback } from 'react'
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 50

function formatTs(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function AccessLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'granted' | 'denied'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('access_logs')
        .select(`
          id, scanned_at, method, granted, denied_reason, sucursal_id,
          users:user_id (id, first_name, last_name, email)
        `, { count: 'exact' })
        .order('scanned_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (filter === 'granted') query = query.eq('granted', true)
      if (filter === 'denied')  query = query.eq('granted', false)

      const { data, error, count } = await query
      if (error) throw error
      setLogs(data || [])
      setTotal(count || 0)
    } catch (err) {
      console.error('Error fetching access logs:', err)
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Reset page on filter change
  useEffect(() => { setPage(0) }, [filter])

  const visibleLogs = search.trim()
    ? logs.filter(l => {
        const name = `${l.users?.first_name ?? ''} ${l.users?.last_name ?? ''}`.toLowerCase()
        const email = (l.users?.email ?? '').toLowerCase()
        const q = search.toLowerCase()
        return name.includes(q) || email.includes(q)
      })
    : logs

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Accesos</h1>
          <p className="text-sm text-text-secondary mt-0.5">{total} registros totales</p>
        </div>
        <button
          onClick={fetchLogs}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input flex-1 text-sm"
        />
        <div className="flex gap-2">
          {[['all', 'Todos'], ['granted', 'Permitidos'], ['denied', 'Denegados']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === val
                  ? 'bg-brand text-white'
                  : 'bg-bg-surface text-text-secondary hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="text-center py-16 text-text-secondary text-sm">
            Sin registros
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-bg-surface">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wide">Fecha / Hora</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wide">Socio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wide">Sede</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wide">Método</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wide">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {visibleLogs.map(log => (
                  <tr key={log.id} className="hover:bg-bg-surface transition-colors">
                    <td className="px-4 py-3 text-text-secondary whitespace-nowrap font-mono text-xs">
                      {formatTs(log.scanned_at)}
                    </td>
                    <td className="px-4 py-3">
                      {log.users ? (
                        <div>
                          <p className="font-medium text-text-primary">
                            {log.users.first_name} {log.users.last_name}
                          </p>
                          <p className="text-xs text-text-tertiary">{log.users.email}</p>
                        </div>
                      ) : (
                        <span className="text-text-tertiary italic">Desconocido</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      Palermo #{log.sucursal_id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-bg-surface text-text-secondary">
                        {log.method === 'kiosk_qr' ? 'QR kiosko' : 'QR personal'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.granted ? (
                        <span className="flex items-center gap-1 text-green-600 font-medium">
                          <CheckCircleIcon className="h-4 w-4" /> Permitido
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 font-medium">
                          <XCircleIcon className="h-4 w-4" /> Denegado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-tertiary text-xs">
                      {log.denied_reason ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !search.trim() && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn-secondary disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
