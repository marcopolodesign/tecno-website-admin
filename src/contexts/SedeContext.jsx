import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// La sede activa, para toda la plataforma — no vive en cada pantalla por separado.
//
// Hasta ahora había una sola sede (Palermo) y nada la pedía explícita: Equipamiento traía
// todas las boxes de la base sin filtrar, Leads/Prospects no tenían ni columna de sede. Con
// una segunda sede eso deja de andar solo — el switcher vive acá, una vez, y las pantallas que
// necesitan filtrar por sede leen `sedeId` de acá en vez de inventar su propio estado.
//
// Se persiste en localStorage (misma idea que `admin_token`) para no perder la sede elegida
// entre refrescos — el usuario la elige una vez y la plataforma la recuerda, como cualquier
// admin multi-tenant.

const SedeContext = createContext(null)

const STORAGE_KEY = 'admin_sede_id'

export function SedeProvider({ children }) {
  const [sedes, setSedes] = useState([])
  const [sedeId, setSedeIdState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  const fetchSedes = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      const activas = data || []
      setSedes(activas)

      // La sede guardada puede ya no existir (se desactivó, o localStorage de otra base) — en
      // ese caso, o si nunca hubo una elegida, cae a la primera sede activa.
      setSedeIdState((prev) => {
        const valido = prev && activas.some((s) => s.id === prev)
        const siguiente = valido ? prev : activas[0]?.id || null
        try {
          if (siguiente) localStorage.setItem(STORAGE_KEY, siguiente)
        } catch {
          // localStorage puede fallar (modo privado, storage lleno) — la sede activa sigue
          // funcionando en memoria para esta sesión, sólo no persiste entre refrescos.
        }
        return siguiente
      })
    } catch (error) {
      console.error('Error fetching sedes:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSedes()
  }, [fetchSedes])

  const setSedeId = useCallback((id) => {
    setSedeIdState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Ver comentario de arriba — no es crítico que persista.
    }
  }, [])

  const sede = sedes.find((s) => s.id === sedeId) || null

  return (
    <SedeContext.Provider value={{ sedeId, sede, sedes, loading, setSedeId, refetchSedes: fetchSedes }}>
      {children}
    </SedeContext.Provider>
  )
}

export function useSede() {
  const ctx = useContext(SedeContext)
  if (!ctx) {
    throw new Error('useSede debe usarse dentro de un SedeProvider')
  }
  return ctx
}
