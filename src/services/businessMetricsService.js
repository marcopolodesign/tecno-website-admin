import { supabase } from '../lib/supabase'

// Panel de métricas de negocio del dueño (Sprint 6). Cada métrica es un RPC propio en
// Postgres (ver supabase/migrations/20260909094245_metricas_negocio_dueno.sql) — nada de
// agregador único, mismo criterio que bigg-eye (docs/dashboard-financiero-plan.md, sección
// "Qué NO hacer"): así cada card refetchea sola y un error en una métrica no tira las demás.
//
// Todas aceptan sedeId + rango de fechas (null = sin filtro). El error real de Supabase se
// propaga tal cual (error.message) — nunca se traga ni se reemplaza por un mensaje genérico.

async function callMetric(fnName, params) {
  const { data, error } = await supabase.rpc(fnName, params)
  if (error) throw error
  return data || []
}

export const businessMetricsService = {
  async getLeadToTrial({ sedeId, start, end } = {}) {
    return callMetric('rpc_metric_lead_to_trial', {
      p_location_id: sedeId ?? null,
      p_start: start ?? null,
      p_end: end ?? null,
    })
  },

  async getTrialToMember({ sedeId, start, end } = {}) {
    return callMetric('rpc_metric_trial_to_member', {
      p_location_id: sedeId ?? null,
      p_start: start ?? null,
      p_end: end ?? null,
    })
  },

  async getRetentionByCoach({ sedeId, start, end } = {}) {
    return callMetric('rpc_metric_retention_by_coach', {
      p_location_id: sedeId ?? null,
      p_start: start ?? null,
      p_end: end ?? null,
    })
  },

  async getRetentionBySeller({ sedeId, start, end } = {}) {
    return callMetric('rpc_metric_retention_by_seller', {
      p_location_id: sedeId ?? null,
      p_start: start ?? null,
      p_end: end ?? null,
    })
  },

  async getAttendanceFrequency({ sedeId, start, end } = {}) {
    return callMetric('rpc_metric_attendance_frequency', {
      p_location_id: sedeId ?? null,
      p_start: start ?? null,
      p_end: end ?? null,
    })
  },

  async getChurnRisk({ sedeId } = {}) {
    return callMetric('rpc_metric_churn_risk', { p_location_id: sedeId ?? null })
  },

  async getBenchmarks() {
    const { data, error } = await supabase
      .from('business_metric_benchmarks')
      .select('*')
      .order('metric_key', { ascending: true })
    if (error) throw error
    return data || []
  },

  async updateBenchmark(id, targetValue) {
    const { data, error } = await supabase
      .from('business_metric_benchmarks')
      .update({ target_value: targetValue })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },
}

export default businessMetricsService
