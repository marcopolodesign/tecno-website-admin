import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import businessMetricsService from '../../services/businessMetricsService'
import MetricCard from './MetricCard'
import PendingDataNotice from './PendingDataNotice'

// Métrica 2: conversión de clase de prueba a alumno, atribuida al coach que dio la clase.
// Mismo bloqueo de dato que la métrica 1: depende de leads.trial_class_coach_id/attended_at,
// carga manual, nueva de este sprint.
export default function TrialToMemberChart({ sedeId, start, end, benchmark }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    businessMetricsService
      .getTrialToMember({ sedeId, start, end })
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [sedeId, start, end])

  const totalAttended = rows.reduce((acc, r) => acc + Number(r.trial_attended_count || 0), 0)
  const isEmpty = !loading && !error && totalAttended === 0

  const chartData = rows
    .filter((r) => r.trial_attended_count > 0)
    .map((r) => ({ name: r.coach_name, tasa: Number(r.conversion_rate) || 0, atendieron: r.trial_attended_count, convirtieron: r.converted_count }))

  return (
    <MetricCard
      title="Clase de prueba → alumno"
      description="Conversión atribuida al coach que dio la clase de prueba."
      benchmarkLabel={benchmark ? `Benchmark ${benchmark}%` : null}
      loading={loading}
      error={error}
      isEmpty={false}
    >
      {isEmpty ? (
        <PendingDataNotice>
          Todavía no hay ninguna clase de prueba marcada como asistida (ni un coach asignado a
          una). Esta métrica se activa sola en cuanto el coach empiece a quedar registrado al
          dar la clase — no requiere ningún cambio de código, sólo carga de datos.
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
                      <p className="text-text-secondary">{d.convirtieron} de {d.atendieron} se hicieron socios</p>
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
