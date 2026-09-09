import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import businessMetricsService from '../../services/businessMetricsService'
import MetricCard from './MetricCard'

// Métrica 3: retención por coach y por recepcionista/vendedor. Computable con datos reales
// hoy — usa memberships.previous_membership_id para saber si una membresía vencida se
// renovó, atribuida al coach/seller ASIGNADO ACTUAL del socio (no hay historial de
// reasignaciones, así que si un socio cambió de coach en el medio, la retención completa de
// esa membresía queda en la cuenta del coach actual).
export default function RetentionChart({ by, sedeId, start, end, benchmark }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const isCoach = by === 'coach'
  const fetcher = isCoach ? businessMetricsService.getRetentionByCoach : businessMetricsService.getRetentionBySeller
  const nameKey = isCoach ? 'coach_name' : 'seller_name'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetcher({ sedeId, start, end })
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [by, sedeId, start, end])

  const totalEnded = rows.reduce((acc, r) => acc + Number(r.memberships_ended || 0), 0)
  const isEmpty = !loading && !error && totalEnded === 0

  const chartData = rows
    .filter((r) => r.memberships_ended > 0)
    .map((r) => ({ name: r[nameKey], tasa: Number(r.retention_rate) || 0, vencidas: r.memberships_ended, renovadas: r.renewed_count }))

  return (
    <MetricCard
      title={isCoach ? 'Retención por coach' : 'Retención por recepción'}
      description={
        isCoach
          ? 'De las membresías vencidas en el período, cuántas renovó cada coach.'
          : 'De las membresías vencidas en el período, cuántas renovó cada recepcionista/vendedor.'
      }
      benchmarkLabel={benchmark ? `Benchmark ${benchmark}%` : null}
      loading={loading}
      error={error}
      isEmpty={isEmpty}
      emptyLabel="No hay membresías vencidas en el período elegido todavía."
    >
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
                  <div className="bg-white border border-border-default rounded-md px-3 py-2 shadow-lg text-xs">
                    <p className="font-medium text-text-primary">{d.name}</p>
                    <p className="text-text-secondary">{d.renovadas} de {d.vencidas} membresías se renovaron</p>
                    <p className="text-brand font-semibold">{d.tasa}%</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="tasa" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </MetricCard>
  )
}
