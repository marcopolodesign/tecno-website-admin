import { supabase } from '../lib/supabase'

// Servicio de la pantalla "Hoy" — la portada del día a día del gimnasio.
//
// El resumen numérico (asistidos, clases de prueba, y las 3 alertas) sale de un único RPC
// (rpc_hoy_resumen, ver supabase/migrations/20260909150000_resumen_hoy.sql) en vez de seis
// queries sueltas desde el browser. Las listas que se abren al hacer click en cada bloque
// (quién asistió, qué leads siguen sin contactar, etc.) son selects directos — mismo patrón
// que membershipsService.getExpiringMemberships, no hace falta un RPC para eso.
//
// "Hoy" es el día calendario en America/Argentina/Buenos_Aires (UTC-3 fijo, sin horario de
// verano) — la base corre en UTC, así que un ingreso a las 22:30 ART (01:30 UTC del día
// siguiente) tiene que seguir contando como "hoy". Mismo criterio que ya usa
// supabase/migrations/20260713120000_create_queue_snapshots.sql para sus ventanas horarias.
function todayRangeBA() {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const start = new Date(`${ymd}T00:00:00-03:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export const hoyService = {
  async getResumen({ sedeId, membershipExpiringDays = 30 } = {}) {
    const { data, error } = await supabase.rpc('rpc_hoy_resumen', {
      p_location_id: sedeId ?? null,
      p_membership_expiring_days: membershipExpiringDays,
    })
    if (error) throw error
    return data?.[0] ?? null
  },

  async getAsistidosHoy({ sedeId } = {}) {
    const { start, end } = todayRangeBA()
    let query = supabase
      .from('access_logs')
      .select('id, scanned_at, method, users:user_id (id, first_name, last_name, phone, location_id)')
      .eq('granted', true)
      .gte('scanned_at', start)
      .lt('scanned_at', end)
      .order('scanned_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error
    const rows = sedeId ? (data || []).filter((r) => r.users?.location_id === sedeId) : (data || [])
    return rows
  },

  async getClasesPruebaHoy({ sedeId } = {}) {
    const { start, end } = todayRangeBA()
    let query = supabase
      .from('leads')
      .select(
        'id, first_name, last_name, phone, trial_class_scheduled_at, trial_class_attended_at, location_id, trial_class_coach:trial_class_coach_id (id, first_name, last_name)'
      )
      .gte('trial_class_scheduled_at', start)
      .lt('trial_class_scheduled_at', end)
      .order('trial_class_scheduled_at', { ascending: true })

    if (sedeId) query = query.eq('location_id', sedeId)

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async getMembresiasPorVencer({ sedeId, days = 30 } = {}) {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)

    let query = supabase
      .from('memberships')
      .select('id, end_date, membership_type, users:user_id (id, first_name, last_name, phone, location_id)')
      .eq('status', 'active')
      .lte('end_date', futureDate.toISOString().split('T')[0])
      .order('end_date', { ascending: true })

    const { data, error } = await query
    if (error) throw error
    const rows = sedeId ? (data || []).filter((r) => r.users?.location_id === sedeId) : (data || [])
    return rows
  },

  async getLeadsSinContactar({ sedeId } = {}) {
    let query = supabase
      .from('leads')
      .select('id, first_name, last_name, phone, email, created_at, source')
      .eq('status', 'new')
      .order('created_at', { ascending: true })

    if (sedeId) query = query.eq('location_id', sedeId)

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  // Mismo risk_bucket que ChurnRiskChart (rpc_metric_churn_risk) — nunca un criterio propio
  // que después se desalinee del panel de métricas de negocio.
  async getSociosEnRiesgo({ sedeId } = {}) {
    const { data, error } = await supabase.rpc('rpc_metric_churn_risk', { p_location_id: sedeId ?? null })
    if (error) throw error
    const rows = (data || []).filter((r) => r.risk_bucket === 'risk' || r.risk_bucket === 'high_risk')
    if (rows.length === 0) return rows

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, phone')
      .in('id', rows.map((r) => r.user_id))
    if (usersError) throw usersError
    const phoneById = new Map((users || []).map((u) => [u.id, u.phone]))
    return rows.map((r) => ({ ...r, phone: phoneById.get(r.user_id) || null }))
  },
}

export default hoyService
