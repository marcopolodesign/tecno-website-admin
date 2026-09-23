// Envoltorio fino para las URLs lindas de TV: tv.somostecnofit.com/palermo(/A(/1)). Resuelve
// el slug de la URL a ids reales vía tv_resolver() (RPC pública, SECURITY DEFINER) y renderiza
// la TV que ya existe pasándole los ids resueltos por prop — no duplica ninguna pantalla.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import QueueTv from './QueueTv'
import QueueTvEstacion from './QueueTvEstacion'
import QueueTvSede from './QueueTvSede'

const ESTILO_BASE = {
  position: 'fixed',
  inset: 0,
  background: '#0b0d12',
  color: 'rgba(255,255,255,0.85)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: 40,
}

function PantallaMensaje({ children, tono = 'normal' }) {
  return (
    <div style={{ ...ESTILO_BASE, color: tono === 'error' ? '#f87171' : 'rgba(255,255,255,0.6)' }}>
      <span style={{ fontSize: 24, fontWeight: 600, maxWidth: 640 }}>{children}</span>
    </div>
  )
}

// modo: 'sede' | 'linea' | 'estacion' — decide qué pantalla ya existente renderizar una vez
// resuelto el slug.
export default function TvPorSlug({ modo }) {
  const { sede, linea, estacion } = useParams()
  const [resuelto, setResuelto] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [huboError, setHuboError] = useState(false)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setHuboError(false)
    setResuelto(null)

    supabase
      .rpc('tv_resolver', { p_sede: sede, p_linea: linea || null })
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) throw error
        setResuelto(data ?? null)
      })
      .catch((err) => {
        console.error('Error resolviendo TV por slug:', err)
        if (!cancelado) setHuboError(true)
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [sede, linea])

  if (cargando) return <PantallaMensaje>Cargando…</PantallaMensaje>

  if (huboError) {
    return <PantallaMensaje tono="error">No pudimos conectar. Reintentá en unos segundos.</PantallaMensaje>
  }

  if (!resuelto?.location_id) {
    return <PantallaMensaje tono="error">No encontramos una sede con esa URL. Revisá el link con quien la configuró.</PantallaMensaje>
  }

  if (modo !== 'sede' && !resuelto.line_id) {
    return (
      <PantallaMensaje tono="error">
        {`No encontramos la línea "${linea}" en ${resuelto.sede}.`}
      </PantallaMensaje>
    )
  }

  if (modo === 'estacion') {
    const posicion = Number(estacion)
    if (!posicion) return <PantallaMensaje tono="error">Estación inválida en la URL.</PantallaMensaje>
    return <QueueTvEstacion overrideLineaId={resuelto.line_id} overridePosicion={posicion} />
  }

  if (modo === 'linea') {
    return <QueueTv overrideLineaId={resuelto.line_id} />
  }

  return <QueueTvSede overrideLocationId={resuelto.location_id} />
}
