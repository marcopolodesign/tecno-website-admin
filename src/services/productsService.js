import { supabase, toCamelCase } from '../lib/supabase'

// Catálogo de la caja de mostrador. El catálogo (`products`) es global — "Agua 500ml" es el
// mismo producto en cualquier sede — pero el stock (`product_stock`) es por sede, así que
// todo lo que toca cantidades pide un `locationId`.
//
// El ajuste de stock (reponer/mermar/corregir un conteo) no tiene RPC propia — a diferencia
// de vender, que sí la tiene porque tiene que ser atómica con el descuento de la venta. Acá
// son dos escrituras sueltas (stock_movements + product_stock) sin transacción: dos personas
// ajustando el mismo producto en el mismo instante podrían pisarse. Para el volumen de un
// kiosco de gimnasio no vale la pena una RPC todavía, pero si se vuelve un problema real, la
// solución es un `ajustar_stock()` en la base igual que las demás operaciones de caja.

const productsService = {
  async getProducts(locationId, { includeInactive = false } = {}) {
    let query = supabase
      .from('products')
      .select('*, product_stock(quantity, min_quantity, location_id)')
      .order('name')

    if (!includeInactive) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const productos = toCamelCase(data || []).map((p) => {
      const stock = (p.productStock || []).find((s) => s.locationId === locationId)
      return {
        ...p,
        quantity: stock?.quantity ?? null,
        minQuantity: stock?.minQuantity ?? null,
      }
    })
    return { data: productos }
  },

  async createProduct(locationId, productData) {
    const { data: producto, error } = await supabase
      .from('products')
      .insert([
        {
          name: productData.name,
          description: productData.description || null,
          price: productData.price,
          category: productData.category || null,
          tracks_stock: !!productData.tracksStock,
          is_active: productData.isActive ?? true,
        },
      ])
      .select()
      .single()

    if (error) throw new Error(error.message)

    if (productData.tracksStock && locationId) {
      const { error: stockError } = await supabase.from('product_stock').insert([
        {
          product_id: producto.id,
          location_id: locationId,
          quantity: Number(productData.quantity) || 0,
          min_quantity: Number(productData.minQuantity) || 0,
        },
      ])
      if (stockError) throw new Error(stockError.message)
    }

    return { data: toCamelCase(producto) }
  },

  async updateProduct(id, productData) {
    const { data, error } = await supabase
      .from('products')
      .update({
        name: productData.name,
        description: productData.description || null,
        price: productData.price,
        category: productData.category || null,
        tracks_stock: !!productData.tracksStock,
        is_active: productData.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return { data: toCamelCase(data) }
  },

  // delta positivo repone, negativo da de baja (merma, rotura, corrección de conteo). El
  // motivo es obligatorio del lado de la UI — la tabla no lo fuerza con un CHECK como sí lo
  // hace cash_movements, así que acá sí hay que pedirlo antes de llamar.
  async ajustarStock({ productId, locationId, delta, reason, sellerId, minQuantity }) {
    if (!reason || !reason.trim()) {
      throw new Error('El ajuste de stock necesita un motivo.')
    }

    const { data: actual, error: fetchError } = await supabase
      .from('product_stock')
      .select('*')
      .eq('product_id', productId)
      .eq('location_id', locationId)
      .maybeSingle()
    if (fetchError) throw new Error(fetchError.message)

    const cantidadActual = actual?.quantity ?? 0
    const proxima = cantidadActual + delta
    if (proxima < 0) {
      throw new Error(`Quedan ${cantidadActual} unidades — no se puede descontar ${Math.abs(delta)}.`)
    }

    const { error: upsertError } = await supabase.from('product_stock').upsert(
      {
        product_id: productId,
        location_id: locationId,
        quantity: proxima,
        min_quantity: minQuantity ?? actual?.min_quantity ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product_id,location_id' }
    )
    if (upsertError) throw new Error(upsertError.message)

    const { error: movError } = await supabase.from('stock_movements').insert([
      {
        product_id: productId,
        location_id: locationId,
        delta,
        reason: reason.trim(),
        created_by: sellerId,
      },
    ])
    if (movError) throw new Error(movError.message)

    return { data: { quantity: proxima } }
  },

  async movimientosStock(productId, locationId, limit = 20) {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*, sellers:created_by(first_name, last_name)')
      .eq('product_id', productId)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return { data: toCamelCase(data || []) }
  },
}

export default productsService
