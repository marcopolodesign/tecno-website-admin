// Portada de tv.somostecnofit.com — sólo para cuando alguien entra sin sede en la URL. Lista
// los links lindos de la sede por default (tv_sede(null) resuelve sola a la única/primera sede
// activa). No hay un RPC público que liste TODAS las sedes — con una sede activa por ahora
// alcanza; el día que haya varias, esto se amplía agregando esa función.
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { tvUrlSede, tvUrlLinea, tvUrlEstacion } from '../lib/slug'

const ESTILO = {
  position: 'fixed',
  inset: 0,
  background: '#0b0d12',
  color: 'white',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: 40,
}

function Link({ href }) {
  return (
    <a href={href} style={{ color: '#F45F37', fontSize: 20, fontFamily: 'monospace', textDecoration: 'none' }}>
      {href.replace('https://', '')}
    </a>
  )
}

export default function TvIndex() {
  const [sede, setSede] = useState(null)
  const [lineas, setLineas] = useState([])
  const [error, setError] = useState(false)

  useEffect(() => {
    supabase
      .rpc('tv_sede', { p_location_id: null })
      .then(({ data, error }) => {
        if (error) throw error
        setSede(data?.sede ?? null)
        setLineas(data?.lineas ?? [])
      })
      .catch((err) => {
        console.error('Error cargando la sede por default:', err)
        setError(true)
      })
  }, [])

  return (
    <div style={ESTILO}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>TVs de TecnoFit</h1>
      {error ? (
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>No pudimos cargar las sedes.</p>
      ) : !sede ? (
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Cargando…</p>
      ) : (
        <>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
            Lista de espera de {sede.name}
          </p>
          <Link href={tvUrlSede(sede.name)} />
          {lineas.map((l) => (
            <div key={l.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 16 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{l.name}</span>
              <Link href={tvUrlLinea(sede.name, l.line_number)} />
              <Link href={tvUrlEstacion(sede.name, l.line_number, 1)} />
            </div>
          ))}
        </>
      )}
    </div>
  )
}
