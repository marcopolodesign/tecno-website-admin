// Plan B del QR de la TV de la lista de espera: quien lo escanea sin la app abre esta página,
// pone su DNI y queda anotado (o confirmado si le toca). Pública, sin sesión: todo pasa por el
// RPC anotarme_por_dni (SECURITY DEFINER, granted a anon), que aplica la misma lógica que
// confirmar-turno de la app. Debajo del form, "Abrir en la app" por el scheme tecnofit://.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { COLOR, GEIST, RADIO, BORDE, superficie } from './tv/tokens'
import { TFMarca } from './tv/Piezas'

const APP_LINK = 'tecnofit://confirmar-turno'

const boton = (primario) => ({
  width: '100%', height: 56, borderRadius: RADIO.pildora, boxSizing: 'border-box', fontFamily: GEIST, fontSize: 18, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', cursor: 'pointer',
  ...(primario ? { background: COLOR.texto, color: COLOR.fondo, border: 'none' } : { background: 'transparent', color: COLOR.texto, border: BORDE }),
})

// estado del RPC -> { titulo, detalle, acento }
function mensaje(r) {
  const n = r.nombre ? `${r.nombre}, ` : ''
  switch (r.estado) {
    case 'esperando': return { titulo: `${n}estás en la lista`, grande: `#${r.posicion}`, detalle: r.posicion === 1 ? 'Sos el próximo. Mirá la pantalla: cuando te toque, volvé a escanear.' : 'Mirá la pantalla: cuando te toque, volvé a escanear para confirmar.' }
    case 'confirmado': return { titulo: `¡Adentro, ${r.nombre}!`, grande: `${r.linea}1`, detalle: `Pasá al box 1 de la línea ${r.linea}.`, acento: true }
    case 'entrenando': return { titulo: `${n}ya estás entrenando`, grande: `Línea ${r.linea}`, detalle: 'Seguí con tu circuito.' }
    case 'vencido': return { titulo: `${n}se venció tu turno`, detalle: 'Escaneá de nuevo para volver a anotarte.' }
    case 'box_ocupado': return { titulo: `${n}tu turno es en la línea ${r.linea}`, detalle: 'El box 1 todavía está ocupado. Esperá un momento y volvé a escanear.' }
    case 'dni_invalido': return { titulo: 'Revisá el DNI', detalle: 'Ingresalo sin puntos, entre 6 y 9 números.', error: true }
    case 'limite': return { titulo: 'Demasiados intentos', detalle: 'Esperá unos minutos y probá de nuevo.', error: true }
    default: return { titulo: 'No encontramos un socio activo con ese DNI', detalle: 'Revisá el número o consultá en recepción.', error: true }
  }
}

export default function Anotarme() {
  const [dni, setDni] = useState('')
  const [cargando, setCargando] = useState(false)
  const [res, setRes] = useState(null)
  const [fallo, setFallo] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    setCargando(true); setFallo(null)
    try {
      const { data, error } = await supabase.rpc('anotarme_por_dni', { p_dni: dni })
      if (error) throw error
      setRes(data)
    } catch (err) {
      setRes(null); setFallo(err.message || 'No pudimos conectar')
    } finally {
      setCargando(false)
    }
  }

  const m = res ? mensaje(res) : null
  return (
    <div style={{ minHeight: '100dvh', background: COLOR.fondo, color: COLOR.texto, fontFamily: GEIST, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 440, boxSizing: 'border-box', padding: '28px 20px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <TFMarca width={48} />
          <span style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1 }}>Lista de espera</span>
        </div>

        {m ? (
          <div style={{ ...superficie(RADIO.panel), padding: 28, display: 'flex', flexDirection: 'column', gap: 12, ...(m.acento ? { border: `3px solid ${COLOR.trabajo}` } : null) }} role="status">
            <span style={{ fontSize: 22, fontWeight: 800, color: m.error ? COLOR.texto : COLOR.texto }}>{m.titulo}</span>
            {m.grande && <span style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3, lineHeight: 1, color: m.acento ? COLOR.trabajo : COLOR.texto }}>{m.grande}</span>}
            <span style={{ fontSize: 17, color: COLOR.texto66, lineHeight: 1.35 }}>{m.detalle}</span>
            <button type="button" onClick={() => { setRes(null); setDni('') }} style={{ ...boton(false), height: 48, fontSize: 16, marginTop: 8 }}>Probar con otro DNI</button>
          </div>
        ) : (
          <form onSubmit={enviar} style={{ ...superficie(RADIO.panel), padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label htmlFor="dni" style={{ fontSize: 22, fontWeight: 800 }}>Anotate con tu DNI</label>
            <input
              id="dni" name="dni" inputMode="numeric" autoComplete="off" placeholder="Tu DNI, sin puntos" value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 9))}
              style={{ height: 60, borderRadius: RADIO.tarjeta, background: COLOR.superficie, border: BORDE, color: COLOR.texto, fontSize: 24, fontFamily: GEIST, padding: '0 20px', outline: 'none', boxSizing: 'border-box', width: '100%' }}
            />
            <button type="submit" disabled={cargando || dni.length < 6} style={{ ...boton(true), opacity: cargando || dni.length < 6 ? 0.5 : 1 }}>
              {cargando ? 'Un momento…' : 'Anotarme'}
            </button>
            {fallo && <span style={{ fontSize: 15, color: COLOR.texto66 }} role="alert">{fallo}</span>}
            <span style={{ fontSize: 15, color: COLOR.texto45 }}>Si ya estás en la lista y te toca, esto confirma tu turno.</span>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <a href={APP_LINK} style={boton(false)}>Abrir en la app</a>
          <span style={{ fontSize: 14, color: COLOR.texto45, textAlign: 'center' }}>¿Tenés la app de TecnoFit? Abrila y se hace con un toque.</span>
        </div>
      </div>
    </div>
  )
}
