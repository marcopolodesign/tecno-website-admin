import { supabase, toCamelCase } from '../lib/supabase'
import { authService } from './authService'
import { usersService } from './usersService'
import membershipPlansService from './membershipPlansService'
import membershipsService from './membershipsService'

// Todo lo de caja de mostrador: abrir/cerrar turno, vender, cobrar deuda, anular. Es una capa
// fina sobre las RPC de tecnofit-supabase (abrir_caja, resumen_caja, cerrar_caja,
// registrar_venta, registrar_cobro, anular_venta, saldo_socio) — esas ya validan todo
// (caja cerrada, stock, fiar a consumidor final, cobrar de más) y devuelven el motivo en
// castellano. Esta capa NO repite esas validaciones: las pantallas muestran error.message tal
// cual viene.

// Métodos de pago del mostrador (enum metodo_pago de la base) — un solo lugar para que la UI
// no hardcodee la lista en cada pantalla.
export const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mercadopago', label: 'Mercado Pago' },
]

// `payments.payment_method` (la tabla de membresías, ajena a caja) sólo acepta
// tarjeta/efectivo/transferencia/mercadopago/debito_automatico — no conoce "débito" ni
// "crédito" de mostrador porque ésos son formas de cobrar HOY, mientras que
// debito_automatico es el débito recurrente de una acreditación. Un swipe de tarjeta en el
// mostrador (débito o crédito) es "tarjeta" para el panel de Negocio.
function metodoParaMembresia(metodoCaja) {
  const mapa = {
    efectivo: 'efectivo',
    debito: 'tarjeta',
    credito: 'tarjeta',
    transferencia: 'transferencia',
    mercadopago: 'mercadopago',
  }
  return mapa[metodoCaja] || 'efectivo'
}

const cajaService = {
  METODOS_PAGO,

  // El seller_id que exigen todas las RPC de caja es el de la tabla `sellers`, no el
  // auth_user_id de Supabase Auth — es lo que ya resuelve authService.getCurrentUserProfile()
  // para todo el resto del admin (el perfil de seller trae su propio `id`).
  async getSellerProfile() {
    const profile = await authService.getCurrentUserProfile()
    if (!profile || profile.type !== 'seller') {
      throw new Error('Esta sesión no tiene un vendedor asociado — no se puede operar la caja.')
    }
    return profile
  },

  // Caja abierta en la sede, si hay. null si no hay ninguna — no es un error.
  async getCajaAbierta(locationId) {
    if (!locationId) return { data: null }
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*, sellers:opened_by(first_name, last_name)')
      .eq('location_id', locationId)
      .eq('status', 'abierta')
      .maybeSingle()

    if (error) throw new Error(error.message)
    return { data: data ? toCamelCase(data) : null }
  },

  async abrirCaja(locationId, sellerId, openingAmount) {
    const { data, error } = await supabase.rpc('abrir_caja', {
      p_location_id: locationId,
      p_seller_id: sellerId,
      p_opening_amount: openingAmount || 0,
    })
    if (error) throw new Error(error.message)
    return toCamelCase(data)
  },

  // TABLE(...) → PostgREST devuelve un array de una fila.
  async resumenCaja(sessionId) {
    const { data, error } = await supabase.rpc('resumen_caja', { p_session_id: sessionId })
    if (error) throw new Error(error.message)
    const fila = Array.isArray(data) ? data[0] : data
    return fila ? toCamelCase(fila) : null
  },

  async cerrarCaja(sessionId, sellerId, countedAmount, notes) {
    const { data, error } = await supabase.rpc('cerrar_caja', {
      p_session_id: sessionId,
      p_seller_id: sellerId,
      p_counted_amount: countedAmount,
      p_notes: notes || null,
    })
    if (error) throw new Error(error.message)
    return toCamelCase(data)
  },

  async historialCierres(locationId, limit = 20) {
    if (!locationId) return { data: [] }
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*, abierta_por:opened_by(first_name, last_name), cerrada_por:closed_by(first_name, last_name)')
      .eq('location_id', locationId)
      .eq('status', 'cerrada')
      .order('closed_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return { data: toCamelCase(data || []) }
  },

  // Ventas del turno — para mostrarlas en la pantalla de Caja y decidir qué se puede anular.
  async ventasSesion(sessionId) {
    if (!sessionId) return { data: [] }
    const { data, error } = await supabase
      .from('sales')
      .select('*, users:user_id(first_name, last_name), sale_payments(method, amount)')
      .eq('cash_session_id', sessionId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return { data: toCamelCase(data || []) }
  },

  // Registra la venta y, si hay un renglón de membresía, da de alta o renueva la membresía del
  // socio. La venta y la membresía viven en caminos separados (registrar_venta es atómica del
  // lado de la base; crear/renovar membresía es otro grupo de escrituras aparte), así que si
  // la membresía falla la venta NO puede quedar cobrada sin ella: se anula, con el motivo
  // "Falló el alta de la membresía", y se muestra el error real de por qué falló.
  //
  // Contabilidad, para que quede escrito una sola vez: la plata de una membresía vendida por
  // caja queda anotada DOS VECES a propósito, con dos preguntas distintas. `sale_payments`
  // (turno) contesta "¿cuánta plata entró al cajón hoy, y de qué método?" — eso es lo que
  // arma el arqueo. `payments` (membresías) contesta "¿cuánto facturamos en membresías?" —
  // eso es lo que lee el panel de Negocio. No son el mismo asiento duplicado por error: un
  // total combinado de ingresos tiene que sumar `payments` (membresías) + los renglones de
  // PRODUCTO de `sales` — nunca las dos tablas completas, porque ahí sí se contaría el precio
  // de la membresía dos veces.
  async registrarVenta({ locationId, sellerId, items, payments, userId = null, notes = null }) {
    const itemsMembresia = (items || []).filter((i) => i.membershipPlanId)
    if (itemsMembresia.length > 1) {
      throw new Error('Por ahora una venta lleva como máximo una membresía. Hacé una venta aparte para la segunda.')
    }
    const itemMembresia = itemsMembresia[0] || null
    if (itemMembresia && !userId) {
      throw new Error('Para vender una membresía hay que elegir un socio — a consumidor final no se le puede asignar.')
    }

    const rpcItems = (items || []).map((i) => ({
      product_id: i.productId || undefined,
      membership_plan_id: i.membershipPlanId || undefined,
      description: i.description,
      unit_price: i.unitPrice,
      quantity: i.quantity || 1,
    }))
    const rpcPayments = (payments || []).map((p) => ({
      method: p.method,
      amount: p.amount,
      mercadopago_payment_id: p.mercadopagoPaymentId || undefined,
    }))

    const { data: ventaRaw, error } = await supabase.rpc('registrar_venta', {
      p_location_id: locationId,
      p_seller_id: sellerId,
      p_items: rpcItems,
      p_payments: rpcPayments,
      p_user_id: userId,
      p_notes: notes,
    })
    if (error) throw new Error(error.message)
    const venta = toCamelCase(ventaRaw)

    if (itemMembresia) {
      try {
        await darMembresiaPorVenta({ userId, itemMembresia, payments: payments || [] })
      } catch (membresiaError) {
        try {
          await supabase.rpc('anular_venta', {
            p_sale_id: venta.id,
            p_seller_id: sellerId,
            p_reason: 'Falló el alta de la membresía',
          })
        } catch (anularError) {
          throw new Error(
            `La membresía no se pudo dar de alta (${membresiaError.message}) y ADEMÁS no se pudo anular la venta ${venta.numero} (${anularError.message}). Anulala a mano desde Caja.`
          )
        }
        throw new Error(
          `No se pudo dar de alta la membresía, así que la venta se anuló: ${membresiaError.message}`
        )
      }
    }

    return venta
  },

  async registrarCobro(saleId, locationId, sellerId, method, amount) {
    const { data, error } = await supabase.rpc('registrar_cobro', {
      p_sale_id: saleId,
      p_location_id: locationId,
      p_seller_id: sellerId,
      p_method: method,
      p_amount: amount,
    })
    if (error) throw new Error(error.message)
    return toCamelCase(data)
  },

  async anularVenta(saleId, sellerId, reason) {
    const { data, error } = await supabase.rpc('anular_venta', {
      p_sale_id: saleId,
      p_seller_id: sellerId,
      p_reason: reason,
    })
    if (error) throw new Error(error.message)
    return toCamelCase(data)
  },

  async saldoSocio(userId) {
    const { data, error } = await supabase.rpc('saldo_socio', { p_user_id: userId })
    if (error) throw new Error(error.message)
    return Number(data) || 0
  },

  // Socios con saldo pendiente en una sede — no hay una RPC de listado (saldo_socio es por
  // socio), así que se arma acá con el mismo criterio que la función: por cada venta
  // completada, total menos lo cobrado contra ESA venta puntual.
  async deudoresSede(locationId) {
    if (!locationId) return { data: [] }
    const { data, error } = await supabase
      .from('sales')
      .select('id, numero, total, created_at, user_id, users:user_id(first_name, last_name, email, phone), sale_payments(amount)')
      .eq('location_id', locationId)
      .eq('status', 'completada')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)

    const porSocio = new Map()
    for (const venta of data || []) {
      const cobrado = (venta.sale_payments || []).reduce((acc, p) => acc + Number(p.amount), 0)
      const pendiente = Number(venta.total) - cobrado
      if (pendiente <= 0.009) continue

      const key = venta.user_id
      if (!porSocio.has(key)) {
        porSocio.set(key, { userId: key, user: toCamelCase(venta.users), saldo: 0, ventas: [] })
      }
      const entrada = porSocio.get(key)
      entrada.saldo += pendiente
      entrada.ventas.push({
        id: venta.id,
        numero: venta.numero,
        total: Number(venta.total),
        cobrado,
        pendiente,
        createdAt: venta.created_at,
      })
    }

    return { data: Array.from(porSocio.values()).sort((a, b) => b.saldo - a.saldo) }
  },

  // Movimientos que no son ventas (ingreso/egreso) — insert directo, sin RPC: no arrastran
  // ninguna validación además del motivo obligatorio, que ya lo pone el CHECK de la tabla.
  async registrarMovimiento(sessionId, tipo, amount, reason, sellerId) {
    const { data, error } = await supabase
      .from('cash_movements')
      .insert([{ cash_session_id: sessionId, tipo, amount, reason, created_by: sellerId }])
      .select()
      .single()
    if (error) throw new Error(error.message)
    return toCamelCase(data)
  },

  async movimientosSesion(sessionId) {
    if (!sessionId) return { data: [] }
    const { data, error } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('cash_session_id', sessionId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return { data: toCamelCase(data || []) }
  },
}

async function darMembresiaPorVenta({ userId, itemMembresia, payments }) {
  const { data: user } = await usersService.getUser(userId)
  const { data: plan } = await membershipPlansService.getPlan(itemMembresia.membershipPlanId)
  if (!plan) throw new Error('El plan de membresía de esta venta ya no existe.')

  const inicio = new Date()
  const startDate = inicio.toISOString().split('T')[0]
  const fin = new Date(inicio)
  fin.setMonth(fin.getMonth() + (plan.durationMonths || 1))
  const endDate = fin.toISOString().split('T')[0]

  // Cuando el cobro se dividió entre varios métodos, el "método" que queda anotado en el
  // panel de Negocio es el de mayor monto — no existe un valor "mixto" en payments.payment_method.
  const metodoPrincipal = payments.length
    ? payments.reduce((mayor, actual) => (actual.amount > mayor.amount ? actual : mayor)).method
    : 'efectivo'

  const paymentData = {
    amount: Number(itemMembresia.unitPrice) * (itemMembresia.quantity || 1),
    paymentMethod: metodoParaMembresia(metodoPrincipal),
    paymentDate: new Date().toISOString(),
    notes: payments.length > 1 ? 'Venta de mostrador (caja) — cobro dividido' : 'Venta de mostrador (caja)',
  }

  const tieneMembresiaActiva = user?.membershipStatus === 'active' && !!user?.currentMembershipId

  if (tieneMembresiaActiva) {
    await membershipsService.renewMembership(
      userId,
      user.currentMembershipId,
      {
        membershipPlanId: plan.id,
        membershipType: plan.name,
        startDate,
        endDate,
      },
      paymentData
    )
  } else {
    await membershipsService.createMembership(
      {
        userId,
        membershipPlanId: plan.id,
        membershipType: plan.name,
        startDate,
        endDate,
      },
      paymentData
    )
  }
}

export default cajaService
