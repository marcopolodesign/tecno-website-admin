import { supabase, toCamelCase } from '../lib/supabase'

// Capa fina sobre las RPC de caja (`caja_abrir_turno`, `caja_registrar_venta`,
// `caja_anular_venta`, `caja_cobrar_cuenta`, `caja_saldo_socio`, `caja_resumen_turno`,
// `caja_cerrar_turno`) y las tablas `caja_turnos`/`caja_ventas`/`caja_venta_items`/
// `caja_venta_pagos`/`caja_movimientos` — el modelo real aplicado en staging
// (`20260909223000_caja_modelo.sql` y `20260909223500_caja_operaciones.sql`).
//
// Esta capa NO repite las validaciones de esas funciones: ya devuelven el motivo en
// castellano pensado para mostrar tal cual (ej. "Los pagos suman X y la venta es de Y"),
// así que acá sólo se envuelve el error de Supabase en un Error normal.

// Medios de pago "reales" — entran plata al cajón (o salen, en un movimiento). Se usan
// para abrir/cerrar caja, movimientos y cobrar cuenta corriente.
export const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mercadopago', label: 'Mercado Pago' },
]

// Para el cobro de una venta se puede fiar además — no aplica a movimientos ni a
// cobrar_cuenta (fiar lo que ya es una deuda no tiene sentido).
export const METODOS_PAGO_VENTA = [
  ...METODOS_PAGO,
  { value: 'cuenta_corriente', label: 'Cuenta corriente (fiado)' },
]

// Los tres precios de un plan de membresía (`membership_plans`), para elegir cuál se le
// aplica a la venta según cómo se lo va a cobrar.
export const PRECIOS_PLAN = [
  { value: 'price_efectivo', label: 'Efectivo' },
  { value: 'price_debito_automatico', label: 'Débito automático' },
  { value: 'price_tarjeta_transferencia', label: 'Tarjeta / transferencia' },
]

const cajaService = {
  METODOS_PAGO,
  METODOS_PAGO_VENTA,
  PRECIOS_PLAN,

  // Turno abierto en la sede, si hay. null si no hay ninguno — no es un error.
  async getTurnoAbierto(locationId) {
    if (!locationId) return null
    const { data, error } = await supabase
      .from('caja_turnos')
      .select('*, abierto_por_seller:abierto_por(first_name,last_name)')
      .eq('location_id', locationId)
      .eq('estado', 'abierto')
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? toCamelCase(data) : null
  },

  async abrirTurno(locationId, montoInicial) {
    const { data, error } = await supabase.rpc('caja_abrir_turno', {
      p_location_id: locationId,
      p_monto_inicial: Number(montoInicial) || 0,
    })
    if (error) throw new Error(error.message)
    return toCamelCase(data)
  },

  // `caja_resumen_turno` es TABLE(...) — PostgREST la devuelve como array de una fila.
  // A propósito NO trae efectivo_esperado: eso lo revela sólo `cerrarTurno`, para que el
  // arqueo sea a ciegas.
  async resumenTurno(turnoId) {
    if (!turnoId) return null
    const { data, error } = await supabase.rpc('caja_resumen_turno', { p_turno_id: turnoId })
    if (error) throw new Error(error.message)
    const fila = Array.isArray(data) ? data[0] : data
    return fila ? toCamelCase(fila) : null
  },

  async ventasTurno(turnoId) {
    if (!turnoId) return []
    const { data, error } = await supabase
      .from('caja_ventas')
      .select(
        '*, socio:user_id(first_name,last_name), caja_venta_pagos(medio_pago,monto), caja_venta_items(descripcion,cantidad,precio_unitario,subtotal)'
      )
      .eq('turno_id', turnoId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return toCamelCase(data || [])
  },

  async movimientosTurno(turnoId) {
    if (!turnoId) return []
    const { data, error } = await supabase
      .from('caja_movimientos')
      .select('*')
      .eq('turno_id', turnoId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return toCamelCase(data || [])
  },

  async historialTurnos(locationId, limit = 10) {
    if (!locationId) return []
    const { data, error } = await supabase
      .from('caja_turnos')
      .select(
        '*, abierto_por_seller:abierto_por(first_name,last_name), cerrado_por_seller:cerrado_por(first_name,last_name)'
      )
      .eq('location_id', locationId)
      .eq('estado', 'cerrado')
      .order('cerrado_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return toCamelCase(data || [])
  },

  // p_items: [{ tipo: 'producto'|'plan', id, cantidad, precio_unitario }]
  // p_pagos: [{ medio, monto }]
  async registrarVenta({ turnoId, items, pagos, userId = null, descuentoMonto = 0, descuentoMotivo = null, notas = null }) {
    const { data, error } = await supabase.rpc('caja_registrar_venta', {
      p_turno_id: turnoId,
      p_items: items,
      p_pagos: pagos,
      p_user_id: userId || null,
      p_descuento_monto: Number(descuentoMonto) || 0,
      p_descuento_motivo: descuentoMotivo || null,
      p_notas: notas || null,
    })
    if (error) throw new Error(error.message)
    return data // uuid de la venta
  },

  // `p_devolver_efectivo`: true (default en la UI) = la plata SALIÓ del cajón al cliente —
  // `caja_resumen_turno` ya excluye la venta anulada de sus totales, así que no hace falta
  // nada más. false = fue un error de carga y el billete nunca se movió: ahí la función
  // mete un ingreso compensatorio para que el efectivo esperado no baje de más.
  async anularVenta(ventaId, motivo, devolverEfectivo = true) {
    const { error } = await supabase.rpc('caja_anular_venta', {
      p_venta_id: ventaId,
      p_motivo: motivo,
      p_devolver_efectivo: devolverEfectivo,
    })
    if (error) throw new Error(error.message)
  },

  async cobrarCuenta(turnoId, userId, monto, medio = 'efectivo') {
    const { error } = await supabase.rpc('caja_cobrar_cuenta', {
      p_turno_id: turnoId,
      p_user_id: userId,
      p_monto: Number(monto),
      p_medio: medio,
    })
    if (error) throw new Error(error.message)
  },

  async saldoSocio(userId) {
    if (!userId) return 0
    const { data, error } = await supabase.rpc('caja_saldo_socio', { p_user_id: userId })
    if (error) throw new Error(error.message)
    return Number(data) || 0
  },

  // Arqueo a ciegas: sólo acá se conoce efectivo_esperado y la diferencia, en la
  // respuesta — nunca antes.
  async cerrarTurno(turnoId, efectivoContado, notas) {
    const { data, error } = await supabase.rpc('caja_cerrar_turno', {
      p_turno_id: turnoId,
      p_efectivo_contado: Number(efectivoContado),
      p_notas: notas || null,
    })
    if (error) throw new Error(error.message)
    return toCamelCase(data)
  },

  // Ingreso/egreso — insert directo, sin RPC: no arrastra otra validación además del
  // motivo obligatorio, que ya lo pide la pantalla.
  async registrarMovimiento({ turnoId, tipo, categoria, detalle, monto, medioPago = 'efectivo', creadoPor }) {
    const { data, error } = await supabase
      .from('caja_movimientos')
      .insert([
        {
          turno_id: turnoId,
          tipo,
          categoria,
          detalle: detalle || null,
          monto: Number(monto),
          medio_pago: medioPago,
          creado_por: creadoPor || null,
        },
      ])
      .select()
      .single()
    if (error) throw new Error(error.message)
    return toCamelCase(data)
  },

  // Buscador de socios para asignar una venta o cobrar cuenta corriente.
  async buscarSocios(query) {
    const q = (query || '').trim()
    if (q.length < 2) return []
    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, phone')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8)
    if (error) throw new Error(error.message)
    return toCamelCase(data || [])
  },
}

export default cajaService
