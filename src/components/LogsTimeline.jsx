import { useState, useEffect } from 'react'
import logsService from '../services/logsService'
import { formatLogTimestamp, getLogIcon, getLogColor } from '../utils/logHelpers'

const LogsTimeline = ({ userId, membershipId, limit = 20 }) => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetchLogs()
  }, [userId, membershipId])

  const fetchLogs = async () => {
    try {
      let response
      if (userId) {
        response = await logsService.getUserLogs(userId, limit)
      } else if (membershipId) {
        response = await logsService.getMembershipLogs(membershipId, limit)
      }
      setLogs(response.data || [])
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const displayedLogs = showAll ? logs : logs.slice(0, 5)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-primary">Historial de Actividad</h4>
        {logs.length > 0 && (
          <span className="text-xs text-text-tertiary">{logs.length} registro{logs.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-bg-surface mb-3">
            <span className="text-2xl">📋</span>
          </div>
          <p className="text-sm text-text-tertiary">No hay actividad registrada</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {displayedLogs.map((log, index) => (
              <div 
                key={log.id} 
                className="flex items-start gap-3 p-3 bg-bg-surface rounded-lg hover:bg-bg-surface/80 transition-colors"
              >
                {/* Icon */}
                <div className="shrink-0">
                  <span className="text-xl">{getLogIcon(log.actionType)}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary leading-snug">
                    {log.actionDescription}
                  </p>
                  
                  {/* Metadata */}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-text-tertiary">
                      {formatLogTimestamp(log.createdAt)}
                    </span>
                    
                    {log.performedByName && log.performedByName !== 'Sistema' && (
                      <>
                        <span className="text-xs text-text-tertiary">•</span>
                        <span className="text-xs text-text-secondary">
                          por {log.performedByName}
                        </span>
                      </>
                    )}

                    {log.performedByType === 'system' && (
                      <>
                        <span className="text-xs text-text-tertiary">•</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-info/10 text-info">
                          Automático
                        </span>
                      </>
                    )}
                  </div>

                  {/* Changes details */}
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-info cursor-pointer hover:text-info/80 transition-colors">
                        Ver detalles
                      </summary>
                      <div className="mt-2 p-2 bg-bg-primary rounded border border-border-default">
                        <dl className="space-y-1">
                          {Object.entries(log.changes).map(([key, value]) => (
                            <div key={key} className="flex gap-2 text-xs">
                              <dt className="text-text-tertiary font-medium min-w-[100px]">
                                {key.replace(/_/g, ' ')}:
                              </dt>
                              <dd className="text-text-secondary">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </details>
                  )}
                </div>

                {/* Timeline connector */}
                {index < displayedLogs.length - 1 && (
                  <div className="absolute left-[22px] top-[52px] w-0.5 h-[calc(100%-52px)] bg-border-default" 
                       style={{ marginLeft: '0.75rem' }} />
                )}
              </div>
            ))}
          </div>

          {/* Show more/less button */}
          {logs.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full py-2 text-sm text-info hover:text-info/80 transition-colors"
            >
              {showAll ? '← Ver menos' : `Ver todos (${logs.length})`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default LogsTimeline

