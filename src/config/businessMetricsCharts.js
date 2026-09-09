import LeadToTrialChart from '../components/business-metrics/LeadToTrialChart'
import TrialToMemberChart from '../components/business-metrics/TrialToMemberChart'
import RetentionChart from '../components/business-metrics/RetentionChart'
import AttendanceFrequencyChart from '../components/business-metrics/AttendanceFrequencyChart'
import ChurnRiskChart from '../components/business-metrics/ChurnRiskChart'

// Registro declarativo de las métricas del panel de negocio — mismo patrón que
// bigg-eye/src/config/dashboardCharts.js: cada métrica es una fila con su componente, su
// ancho de grilla (colSpan sobre 12) y de dónde saca sus props. Agregar una métrica nueva es
// agregar una fila acá, no tocar el layout de la página.
export const BUSINESS_METRICS_REGISTRY = [
  {
    id: 'leadToTrial',
    label: 'Lead → clase de prueba',
    component: LeadToTrialChart,
    colSpan: 6,
    getProps: (d) => ({ sedeId: d.sedeId, start: d.start, end: d.end, benchmark: d.benchmarks.lead_to_trial_rate }),
  },
  {
    id: 'trialToMember',
    label: 'Clase de prueba → alumno',
    component: TrialToMemberChart,
    colSpan: 6,
    getProps: (d) => ({ sedeId: d.sedeId, start: d.start, end: d.end, benchmark: d.benchmarks.trial_to_member_rate }),
  },
  {
    id: 'retentionByCoach',
    label: 'Retención por coach',
    component: RetentionChart,
    colSpan: 6,
    getProps: (d) => ({ by: 'coach', sedeId: d.sedeId, start: d.start, end: d.end, benchmark: d.benchmarks.retention_rate }),
  },
  {
    id: 'retentionBySeller',
    label: 'Retención por recepción',
    component: RetentionChart,
    colSpan: 6,
    getProps: (d) => ({ by: 'seller', sedeId: d.sedeId, start: d.start, end: d.end, benchmark: d.benchmarks.retention_rate }),
  },
  {
    id: 'attendanceFrequency',
    label: 'Frecuencia de asistencia',
    component: AttendanceFrequencyChart,
    colSpan: 6,
    getProps: (d) => ({ sedeId: d.sedeId, start: d.start, end: d.end, benchmark: d.benchmarks.attendance_frequency_per_week }),
  },
  {
    id: 'churnRisk',
    label: 'Predicción de abandono',
    component: ChurnRiskChart,
    colSpan: 6,
    getProps: (d) => ({ sedeId: d.sedeId, benchmarkDays: d.benchmarks.churn_risk_days_since_visit }),
  },
]
