import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import businessMetricsService from '../../services/businessMetricsService'
import MetricCard from './MetricCard'

const BUCKETS = [
  { label: '0x/sem', min: 0, max: 0 },
  { label: '0-1x/sem', min: 0.001, max: 1 },
  { label: '1-2x/sem', min: 1.001, max: 2 },
  { label: '2-3x/sem', min: 2.001, max: 3 },
  { label: '3x+/sem', min: 3.001, max: Infinity },
]

// Métrica 4: frecuencia de asistencia por socio, en base a access_logs. Computable con
// datos reales hoy (no depende de ninguna carga manual nueva) — el histograma agrupa a los
// socios activos según cuántas veces por semana entraron en el período.
export default function AttendanceFrequencyChart({ sedeId, start, end, benchmark }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    businessMetricsService
      .getAttendanceFrequency({ sedeId, start, end })
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [sedeId, start, end])

  const { chartData, avg, isEmpty } = useMemo(() => {
    if (!rows.length) return { chartData: [], avg: 0, isEmpty: true }
    const totalVisits = rows.reduce((acc, r) => acc + Number(r.visits_count || 0), 0)
    const buckets = BUCKETS.map((b) => ({
      name: b.label,
      socios: rows.filter((r) => Number(r.visits_per_week) >= b.min && Number(r.visits_per_week) <= b.max).length,
    }))
    return {
      chartData: buckets,
      avg: totalVisits === 0 ? 0 : Number((rows.reduce((acc, r) => acc + Number(r.visits_per_week || 0), 0) / rows.length).toFixed(2)),
      isEmpty: totalVisits === 0,
    }
  }, [rows])

  return (
    <MetricCard
      title="Frecuencia de asistencia"
      description="Socios activos, agrupados por veces que entraron por semana en el período."
      benchmarkLabel={benchmark ? `Benchmark ${benchmark}x/sem` : null}
      loading={loading}
      error={error}
      isEmpty={isEmpty}
      emptyLabel="Todavía no hay ingresos registrados (access_logs) para calcular esto."
      footer={!isEmpty && <p className="text-xs text-text-secondary">Promedio del período: <span className="font-semibold text-text-primary">{avg}x/semana</span></p>}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: '#e5e7eb' }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: '#e5e7eb' }} allowDecimals={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                return (
                  <div className="bg-white rounded-md px-3 py-2 shadow-lg text-xs">
                    <p className="font-medium text-text-primary">{d.name}</p>
                    <p className="text-brand font-semibold">{d.socios} socio{d.socios !== 1 ? 's' : ''}</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="socios" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </MetricCard>
  )
}
