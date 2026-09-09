import { supabase } from '../lib/supabase'

// Embudo de captación: prospecto -> lead -> contactado -> clase de prueba -> asistió -> socio.
// Los dos RPC viven en la migración 20260909190430_funnel_embudo.sql. El conteo es acumulado
// (cada etapa incluye a los que siguieron avanzando) — el porqué está escrito ahí.
//
// El error real de Supabase se propaga tal cual (error.message), nunca se traga.

async function llamar(fn, params) {
  const { data, error } = await supabase.rpc(fn, params)
  if (error) throw error
  return data || []
}

export const funnelService = {
  async getEtapas({ sedeId, start, end } = {}) {
    return llamar('rpc_funnel_etapas', {
      p_location_id: sedeId ?? null,
      p_start: start ?? null,
      p_end: end ?? null,
    })
  },

  /**
   * @param {number} etapa  1..6
   * @param {boolean} soloEstancados  true = sólo los que no avanzaron de esa etapa
   */
  async getPersonas({ etapa, sedeId, start, end, soloEstancados = false, limit = 50, offset = 0 } = {}) {
    return llamar('rpc_funnel_personas', {
      p_etapa: etapa,
      p_location_id: sedeId ?? null,
      p_start: start ?? null,
      p_end: end ?? null,
      p_solo_estancados: soloEstancados,
      p_limit: limit,
      p_offset: offset,
    })
  },
}

export default funnelService
