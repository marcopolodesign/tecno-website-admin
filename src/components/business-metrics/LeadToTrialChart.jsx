import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import businessMetricsService from '../../services/businessMetricsService'
import MetricCard from './MetricCard'
import PendingDataNotice from './PendingDataNotice'

// Métrica 1: conversión de lead a clase de prueba, atribuida a quien recibió al lead
// (recepción/vendedor). Depende de leads.trial_class_scheduled_at / attended_at — columnas
// nuevas de este sprint que hoy nadie carga todavía, así que hasta que recepción empiece a
// marcarlas la card muestra el aviso de dato pendiente en vez de un gráfico vacío.
export default function LeadToTrialChart({ sedeId, start, end, benchmark }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    businessMetricsService
      .getLeadToTrial({ sedeId, start, end })
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [sedeId, start, end])

  const totalLeads = rows.reduce((acc, r) => acc + Number(r.leads_count || 0), 0)
  const totalAttended = rows.reduce((acc, r) => acc + Number(r.trial_attended_count || 0), 0)
  const pending = !loading && !error && totalLeads > 0 && totalAttended === 0
  const isEmpty = !loading && !error && totalLeads === 0

  const chartData = rows
    .filter((r) => r.leads_count > 0)
    .map((r) => ({ name: r.seller_name, tasa: Number(r.conversion_rate) || 0, leads: r.leads_count, asistieron: r.trial_attended_count }))

  return (
    <MetricCard
      title="Lead → clase de prueba"
      description="Conversión atribuida a quien recibió al lead (recepción/vendedor asignado)."
      benchmarkLabel={benchmark ? `Benchmark ${benchmark}%` : null}
      loading={loading}
      error={error}
      isEmpty={isEmpty && !pending}
      emptyLabel="Todavía no hay leads cargados en el período elegido."
    >
      {pending ? (
        <PendingDataNotice>
          Hay {totalLeads} lead{totalLeads !== 1 ? 's' : ''} en el período, pero ninguno tiene
          todavía una clase de prueba agendada o marcada como asistida. Esa carga es manual —
          recepción la completa en la ficha del lead — así que esta métrica queda "pendiente de
          dato" hasta que empiece a registrarse.
        </PendingDataNotice>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: '#e5e7eb' }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: '#e5e7eb' }} unit="%" />
              {benchmark != null && (
                <ReferenceLine y={benchmark} stroke="#F59E0B" strokeDasharray="6 4" label={{ value: `Benchmark ${benchmark}%`, position: 'insideTopRight', fill: '#d97706', fontSize: 11 }} />
              )}
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-white rounded-md px-3 py-2 shadow-lg text-xs">
                      <p className="font-medium text-text-primary">{d.name}</p>
                      <p className="text-text-secondary">{d.asistieron} de {d.leads} leads asistieron a la prueba</p>
                      <p className="text-brand font-semibold">{d.tasa}%</p>
                    </div>
                  )
                }}
              />
              <Bar isAnimationActive={false} dataKey="tasa" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </MetricCard>
  )
}
