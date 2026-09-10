import { supabase, toCamelCase } from '../lib/supabase'

// Catálogo de lo que se vende por mostrador (tabla `productos`). El stock vive en la propia
// fila del producto — no hay una tabla de stock aparte por sede como en un negocio
// multi-depósito — así que todo lo que toca cantidades pide sólo `producto_id`.
//
// El único camino para cambiar `stock_actual` es la RPC `producto_cargar_stock`: cantidad
// positiva repone (compra a proveedor), negativa da de baja (rotura, vencido, corrección de
// conteo). La RPC escribe el movimiento en `producto_stock_movimientos` en la misma
// operación y resuelve sola quién lo hizo vía `caja_seller_actual()` (auth.uid() ->
// sellers.id) — no hace falta pasar un sellerId desde el cliente.
//
// `nombre`, `categoria`, `precio`, `lleva_stock` y `stock_minimo` sí se editan directo sobre
// la tabla: no son un movimiento, son configuración del producto.

const productsService = {
  async getProducts(locationId, { includeInactive = false } = {}) {
    let query = supabase
      .from('productos')
      .select('*')
      .order('categoria', { ascending: true, nullsFirst: false })
      .order('nombre', { ascending: true })

    // location_id null = disponible en todas las sedes (ver comentario en la migración).
    if (locationId) query = query.or(`location_id.eq.${locationId},location_id.is.null`)
    if (!includeInactive) query = query.eq('activo', true)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return { data: toCamelCase(data || []) }
  },

  async createProduct(locationId, productData) {
    if (!productData.nombre || !productData.nombre.trim()) {
      throw new Error('El nombre es obligatorio.')
    }
    const llevaStock = !!productData.llevaStock
    const { data, error } = await supabase
      .from('productos')
      .insert([
        {
          location_id: locationId,
          nombre: productData.nombre.trim(),
          categoria: productData.categoria?.trim() || null,
          precio: Number(productData.precio),
          lleva_stock: llevaStock,
          stock_minimo: llevaStock ? Number(productData.stockMinimo) || 0 : 0,
          activo: productData.activo ?? true,
        },
      ])
      .select()
      .single()
    if (error) throw new Error(error.message)
    return { data: toCamelCase(data) }
  },

  async updateProduct(id, productData) {
    if (!productData.nombre || !productData.nombre.trim()) {
      throw new Error('El nombre es obligatorio.')
    }
    const llevaStock = !!productData.llevaStock
    const { data, error } = await supabase
      .from('productos')
      .update({
        nombre: productData.nombre.trim(),
        categoria: productData.categoria?.trim() || null,
        precio: Number(productData.precio),
        lleva_stock: llevaStock,
        stock_minimo: llevaStock ? Number(productData.stockMinimo) || 0 : 0,
        activo: productData.activo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return { data: toCamelCase(data) }
  },

  // Desactivar en vez de borrar: las ventas viejas (`caja_venta_items.producto_id`) tienen
  // que seguir apuntando a algo. Reactivar es la misma llamada con activo=true.
  async setActivo(id, activo) {
    const { data, error } = await supabase
      .from('productos')
      .update({ activo, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return { data: toCamelCase(data) }
  },

  // cantidad positiva = carga de mercadería, negativa = ajuste a la baja (rotura, vencido,
  // corrección de conteo). Motivo obligatorio del lado de la UI: la RPC lo acepta null pero
  // sin motivo el historial no explica nada.
  async cargarStock(productoId, cantidad, motivo) {
    const delta = Number(cantidad)
    if (!delta) throw new Error('La cantidad tiene que ser distinta de cero.')
    if (!motivo || !motivo.trim()) throw new Error('Contá el motivo del movimiento.')

    const { data, error } = await supabase.rpc('producto_cargar_stock', {
      p_producto_id: productoId,
      p_cantidad: delta,
      p_motivo: motivo.trim(),
    })
    if (error) throw new Error(error.message)
    return { data: toCamelCase(data) }
  },

  async getMovimientos(productoId, limit = 30) {
    const { data, error } = await supabase
      .from('producto_stock_movimientos')
      .select('*, sellers:creado_por(first_name, last_name)')
      .eq('producto_id', productoId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return { data: toCamelCase(data || []) }
  },
}

export default productsService
