import { supabase } from '../lib/supabase'

// Horarios de coaches y vendedores por sede. Es lo que le permite al sistema saber quién
// estaba trabajando cuando un socio entró, y asignárselo sin que nadie lo cargue a mano.
//
// El error real de Supabase se propaga tal cual (error.message) — nunca se traga ni se
// reemplaza por un mensaje genérico.

export const DIAS = [
  { id: 1, nombre: 'Lunes', corto: 'Lun' },
  { id: 2, nombre: 'Martes', corto: 'Mar' },
  { id: 3, nombre: 'Miércoles', corto: 'Mié' },
  { id: 4, nombre: 'Jueves', corto: 'Jue' },
  { id: 5, nombre: 'Viernes', corto: 'Vie' },
  { id: 6, nombre: 'Sábado', corto: 'Sáb' },
  // Domingo es 0 en Postgres (`extract(dow)`), pero va último acá: nadie lee una semana que
  // empieza en domingo.
  { id: 0, nombre: 'Domingo', corto: 'Dom' },
]

export const horariosService = {
  async getFranjas(sedeId) {
    let query = supabase
      .from('franjas_horarias')
      .select(`
        id, location_id, dia_semana, hora_inicio, hora_fin, is_active,
        franja_coaches ( coach_id, coaches ( id, first_name, last_name ) ),
        franja_vendedores ( seller_id, sellers ( id, first_name, last_name ) )
      `)
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true })

    if (sedeId) query = query.eq('location_id', sedeId)

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async crearFranja({ sedeId, diaSemana, horaInicio, horaFin, coachIds = [], sellerIds = [] }) {
    const { data, error } = await supabase
      .from('franjas_horarias')
      .insert([{ location_id: sedeId, dia_semana: diaSemana, hora_inicio: horaInicio, hora_fin: horaFin }])
      .select()
      .single()
    if (error) throw error

    await this.setStaff(data.id, coachIds, sellerIds)
    return data
  },

  async actualizarFranja(franjaId, { diaSemana, horaInicio, horaFin, coachIds = [], sellerIds = [] }) {
    const { error } = await supabase
      .from('franjas_horarias')
      .update({ dia_semana: diaSemana, hora_inicio: horaInicio, hora_fin: horaFin })
      .eq('id', franjaId)
    if (error) throw error

    await this.setStaff(franjaId, coachIds, sellerIds)
  },

  // Se reemplaza el equipo entero de la franja en vez de calcular altas y bajas: son dos o tres
  // personas por turno, y así no hay forma de que queden filas colgadas de una edición a medias.
  async setStaff(franjaId, coachIds, sellerIds) {
    const { error: e1 } = await supabase.from('franja_coaches').delete().eq('franja_id', franjaId)
    if (e1) throw e1
    const { error: e2 } = await supabase.from('franja_vendedores').delete().eq('franja_id', franjaId)
    if (e2) throw e2

    if (coachIds.length) {
      const { error } = await supabase
        .from('franja_coaches')
        .insert(coachIds.map((coach_id) => ({ franja_id: franjaId, coach_id })))
      if (error) throw error
    }
    if (sellerIds.length) {
      const { error } = await supabase
        .from('franja_vendedores')
        .insert(sellerIds.map((seller_id) => ({ franja_id: franjaId, seller_id })))
      if (error) throw error
    }
  },

  async borrarFranja(franjaId) {
    const { error } = await supabase.from('franjas_horarias').delete().eq('id', franjaId)
    if (error) throw error
  },

  async getSugerencias(sedeId) {
    const { data, error } = await supabase.rpc('sugerencias_de_reasignacion', {
      p_location_id: sedeId ?? null,
    })
    if (error) throw error
    return data || []
  },

  // Mueve la asignación de socios que ya existen: sólo se llama desde un botón, con confirmación.
  async recalcular(sedeId, { soloSinAsignar = true } = {}) {
    const { data, error } = await supabase.rpc('recalcular_asignaciones_por_horario', {
      p_location_id: sedeId ?? null,
      p_solo_sin_asignar: soloSinAsignar,
    })
    if (error) throw error
    return data?.[0] ?? { socios_actualizados: 0, socios_sin_franja: 0 }
  },

  async reasignarCoach(userId, coachId) {
    const { error } = await supabase.from('users').update({ assigned_coach_id: coachId }).eq('id', userId)
    if (error) throw error
  },
}

export default horariosService
