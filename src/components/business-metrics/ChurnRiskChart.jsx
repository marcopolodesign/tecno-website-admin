import { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import businessMetricsService from '../../services/businessMetricsService'
import MetricCard from './MetricCard'

// Mejor -> peor. "unknown" es su propio bucket porque un socio activo sin NINGÚN ingreso
// registrado todavía no es lo mismo que uno de alto riesgo — puede ser recién dado de alta.
const RISK_META = {
  very_good: { label: 'Al día', color: '#22c55e' },
  good: { label: 'Bien', color: '#3B82F6' },
  risk: { label: 'Riesgo', color: '#F59E0B' },
  high_risk: { label: 'Alto riesgo', color: '#EF4444' },
  unknown: { label: 'Sin ingresos registrados', color: '#9ca3af' },
}
const RISK_ORDER = ['very_good', 'good', 'risk', 'high_risk', 'unknown']

// Métrica 5: predicción de abandono, en base al benchmark configurable de días sin venir.
// Computable con datos reales hoy (no depende de carga manual) — pero como access_logs
// todavía no tiene ingresos reales en staging, todos los socios activos caen en "unknown"
// hasta que el kiosko de acceso empiece a registrar entradas.
export default function ChurnRiskChart({ sedeId, benchmarkDays }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    businessMetricsService
      .getChurnRisk({ sedeId })
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [sedeId])

  const chartData = useMemo(() => {
    return RISK_ORDER.map((key) => ({
      key,
      name: RISK_META[key].label,
      value: rows.filter((r) => r.risk_bucket === key).length,
      fill: RISK_META[key].color,
    })).filter((d) => d.value > 0)
  }, [rows])

  const highRiskCount = rows.filter((r) => r.risk_bucket === 'high_risk' || r.risk_bucket === 'risk').length
  const isEmpty = !loading && !error && rows.length === 0

  return (
    <MetricCard
      title="Predicción de abandono (churn)"
      description={`Socios activos sin pisar el gym hace ${benchmarkDays ?? 14}+ días (el doble = alto riesgo).`}
      loading={loading}
      error={error}
      isEmpty={isEmpty}
      emptyLabel="No hay socios activos en la sede/período elegido."
      footer={
        !isEmpty && (
          <p className="text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">{highRiskCount}</span> socio{highRiskCount !== 1 ? 's' : ''} en riesgo o alto riesgo de {rows.length} activos
          </p>
        )
      }
    >
      <div className="h-56 flex items-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                return (
                  <div className="bg-white rounded-md px-3 py-2 shadow-lg text-xs">
                    <p className="font-medium text-text-primary">{d.name}</p>
                    <p className="font-semibold" style={{ color: d.fill }}>{d.value} socio{d.value !== 1 ? 's' : ''}</p>
                  </div>
                )
              }}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              formatter={(value) => <span className="text-xs text-text-secondary">{value}</span>}
            />
            <Pie data={chartData} dataKey="value" nameKey="name" cx="35%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} cornerRadius={4}>
              {chartData.map((d) => (
                <Cell key={d.key} fill={d.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </MetricCard>
  )
}
