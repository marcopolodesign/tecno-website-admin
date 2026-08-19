import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Replacing an exercise's clip from the admin.
//
// Until now the only way in was the laptop script: film, AirDrop to a Mac, run a .command, wait.
// That is fine for loading three hundred exercises in a batch and absurd for re-shooting one
// because the framing was wrong.
//
// The file goes straight from the browser to storage — a phone clip is 50-200 MB and routing it
// through a function would be slow and pointless. The server only fetches it back, encodes, and
// records the row.
//
// It lands on a new version rather than over the old one. The renditions are public files that
// every screen in the gym has cached, so writing in place can leave a TV playing last week's
// cut for hours. The previous version stays exactly where it was, which is also what makes this
// safe to do during opening hours.

const SERVIDOR = 'https://tecno-media-marco-polos-projects-1eab697a.vercel.app'

const ETAPAS = {
  pidiendo: 'Pidiendo lugar para el video…',
  subiendo: 'Subiendo el video…',
  procesando: 'Procesando en el servidor — esto tarda unos segundos…',
}

export default function ReemplazarVideo({ ejercicio, onListo }) {
  const [etapa, setEtapa] = useState(null)
  const [error, setError] = useState(null)
  const [hecho, setHecho] = useState(null)
  const archivoRef = useRef(null)

  const reemplazar = async (archivo) => {
    if (!archivo) return
    setError(null)
    setHecho(null)
    try {
      const { data: sesion } = await supabase.auth.getSession()
      const jwt = sesion?.session?.access_token
      if (!jwt) throw new Error('Se cerró la sesión. Volvé a entrar al admin.')

      const auth = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }
      const extension = (archivo.name.split('.').pop() || 'mp4').toLowerCase()

      setEtapa('pidiendo')
      const r1 = await fetch(`${SERVIDOR}/api/subida`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ code: ejercicio.code, extension }),
      })
      const paso1 = await r1.json()
      if (!r1.ok) throw new Error(paso1.error || 'No se pudo pedir el lugar de subida')

      // Straight to storage. The signed URL is single-use and short-lived, so it is fetched
      // for this upload and never held anywhere.
      setEtapa('subiendo')
      const r2 = await fetch(paso1.original.url, {
        method: 'PUT',
        headers: { 'Content-Type': archivo.type || 'video/mp4', 'x-upsert': 'true' },
        body: archivo,
      })
      if (!r2.ok) throw new Error(`No se pudo subir el archivo (${r2.status})`)

      setEtapa('procesando')
      const r3 = await fetch(`${SERVIDOR}/api/procesar`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ code: ejercicio.code, version: paso1.version, extension }),
      })
      const paso3 = await r3.json()
      if (!r3.ok) throw new Error(paso3.error || 'El servidor no pudo procesar el video')

      setHecho(paso3)
      onListo?.(paso3)
    } catch (err) {
      // The real message. "El video no tiene pista de imagen" is something the person filming
      // can act on; "error 500" is not.
      setError(err.message || String(err))
    } finally {
      setEtapa(null)
      if (archivoRef.current) archivoRef.current.value = ''
    }
  }

  const trabajando = etapa !== null

  return (
    <div style={s.caja}>
      <div style={s.fila}>
        <div style={s.texto}>
          <span style={s.titulo}>
            {ejercicio?.tv_path ? 'Reemplazar el video' : 'Subir el video'}
          </span>
          <span style={s.detalle}>
            {ejercicio?.tv_path
              ? 'Se guarda como una versión nueva — la de ahora queda intacta hasta que la nueva esté lista.'
              : 'Elegí el archivo tal como salió del celular. El servidor lo deja listo para la pantalla y para la app.'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => archivoRef.current?.click()}
          disabled={trabajando}
          style={s.boton}
        >
          {trabajando ? 'Trabajando…' : 'Elegir video'}
        </button>
      </div>

      <input
        ref={archivoRef}
        type="file"
        accept="video/*"
        onChange={(ev) => reemplazar(ev.target.files?.[0])}
        style={{ display: 'none' }}
      />

      {etapa && <div style={s.progreso}>{ETAPAS[etapa]}</div>}
      {error && <div style={s.error}>{error}</div>}
      {hecho && (
        <div style={s.ok}>
          Listo — quedó en la versión {hecho.version}, {hecho.duration_seconds}s. Ya se ve en la
          pantalla del box y en la app.
        </div>
      )}
    </div>
  )
}

const s = {
  caja: {
    display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12,
    border: '1px solid #e5e7eb', background: '#fafafa',
  },
  fila: { display: 'flex', alignItems: 'center', gap: 12 },
  texto: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  titulo: { fontSize: 14, fontWeight: 700, color: '#111827' },
  detalle: { fontSize: 12, color: '#6b7280', lineHeight: 1.4 },
  boton: {
    border: '1px solid #e5e7eb', background: 'white', borderRadius: 8, padding: '8px 14px',
    fontSize: 13, fontWeight: 700, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  progreso: {
    padding: '8px 10px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE',
    color: '#1D4ED8', fontSize: 13,
  },
  ok: {
    padding: '8px 10px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0',
    color: '#166534', fontSize: 13,
  },
  error: {
    padding: '8px 10px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA',
    color: '#B91C1C', fontSize: 13,
  },
}
