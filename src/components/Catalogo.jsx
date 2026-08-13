import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mediaUrl } from '../lib/exerciseMedia'
import EncuadreEditor from './EncuadreEditor'

// The exercise catalog the gym actually classified: 296 movements described by pattern,
// role, muscle and the equipment they need.
//
// Two questions this screen exists to answer. "Where is the exercise I am thinking of" —
// which is never one filter, it is a name half-remembered plus a muscle plus what is free
// in the room. And "what is still missing" — which is the whole point of a coverage view:
// filming is the slow part, and knowing what to film next is worth more than knowing how
// many clips exist.
//
// The filtering runs in the database, not here. Same question, same answer, whether it is
// asked by this screen, the app, or whatever comes next.

const ESTADOS_VIDEO = ['Sin filmar', 'Filmado', 'Editado', 'Cargado']

// Above the whole catalog, so a filtered list is never silently cut. If it ever is, the
// header says so rather than quietly reporting a smaller number than the truth.
const LIMITE = 1000

export default function Catalogo() {
  const [q, setQ] = useState('')
  const [musculos, setMusculos] = useState([])
  const [elementos, setElementos] = useState([])
  const [estadoVideo, setEstadoVideo] = useState('')
  const [soloConVideo, setSoloConVideo] = useState(false)

  const [opcionesMusculo, setOpcionesMusculo] = useState([])
  const [opcionesElemento, setOpcionesElemento] = useState([])

  const [resultados, setResultados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [verCobertura, setVerCobertura] = useState(false)
  const [cobertura, setCobertura] = useState([])

  useEffect(() => {
    ;(async () => {
      const [{ data: els }, { data: cat }] = await Promise.all([
        supabase.from('elementos').select('nombre').eq('is_active', true).order('nombre'),
        supabase.from('exercises_catalogo').select('musculo').not('musculo', 'is', null),
      ])
      setOpcionesElemento((els || []).map((e) => e.nombre))
      setOpcionesMusculo([...new Set((cat || []).map((r) => r.musculo))].sort())
    })()
  }, [])

  const buscar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('buscar_ejercicios', {
        q: q.trim() || null,
        musculos: musculos.length ? musculos : null,
        elementos_any: elementos.length ? elementos : null,
        solo_con_video: soloConVideo,
        limite: LIMITE,
      })
      if (err) throw err
      // video_estado is a production state, not a search axis, so it filters the result
      // rather than being another argument the database has to know about.
      const filtrados = estadoVideo ? (data || []).filter((r) => r.video_estado === estadoVideo) : data || []
      setResultados(filtrados)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setCargando(false)
    }
  }, [q, musculos, elementos, soloConVideo, estadoVideo])

  // Typing should feel like filtering, not like submitting a form.
  useEffect(() => {
    const t = setTimeout(buscar, 220)
    return () => clearTimeout(t)
  }, [buscar])

  useEffect(() => {
    if (!verCobertura) return
    ;(async () => {
      const { data } = await supabase
        .from('exercises_catalogo')
        .select('patron, rol, processing_status')
        .eq('is_active', true)
        .not('patron', 'is', null)
      const mapa = new Map()
      for (const r of data || []) {
        const clave = `${r.patron}||${r.rol ?? '—'}`
        const celda = mapa.get(clave) || { patron: r.patron, rol: r.rol ?? '—', total: 0, listos: 0 }
        celda.total += 1
        if (r.processing_status === 'ready') celda.listos += 1
        mapa.set(clave, celda)
      }
      setCobertura([...mapa.values()].sort((a, b) => a.patron.localeCompare(b.patron) || a.rol.localeCompare(b.rol)))
    })()
  }, [verCobertura])

  const alternar = (lista, setLista, valor) =>
    setLista(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor])

  const hayFiltros = q || musculos.length || elementos.length || estadoVideo || soloConVideo

  const resumen = useMemo(() => {
    const listos = resultados.filter((r) => r.processing_status === 'ready').length
    return { total: resultados.length, listos }
  }, [resultados])

  return (
    <div style={e.pagina}>
      <div style={e.encabezado}>
        <div>
          <h1 style={e.h1}>Catálogo de ejercicios</h1>
          <p style={e.sub}>
            {verCobertura
              ? 'Qué falta filmar'
              : cargando
                ? 'Buscando…'
                : `${resumen.total}${resumen.total === LIMITE ? '+' : ''} ejercicios · ${resumen.listos} con video listo`}
          </p>
        </div>
        <button onClick={() => setVerCobertura((v) => !v)} style={e.botonSecundario}>
          {verCobertura ? 'Ver lista' : 'Ver qué falta filmar'}
        </button>
      </div>

      {!verCobertura && (
        <>
          <input
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            placeholder="Buscar por nombre o código — no hace falta escribirlo exacto"
            style={e.buscador}
          />

          <div style={e.filtros}>
            <Grupo titulo="Músculo">
              {opcionesMusculo.map((m) => (
                <Chip key={m} activo={musculos.includes(m)} onClick={() => alternar(musculos, setMusculos, m)}>
                  {m}
                </Chip>
              ))}
            </Grupo>

            <Grupo titulo="Material">
              {opcionesElemento.map((el) => (
                <Chip key={el} activo={elementos.includes(el)} onClick={() => alternar(elementos, setElementos, el)}>
                  {el}
                </Chip>
              ))}
            </Grupo>

            <Grupo titulo="Video">
              {ESTADOS_VIDEO.map((s) => (
                <Chip key={s} activo={estadoVideo === s} onClick={() => setEstadoVideo(estadoVideo === s ? '' : s)}>
                  {s}
                </Chip>
              ))}
              <Chip activo={soloConVideo} onClick={() => setSoloConVideo((v) => !v)}>
                Sólo reproducibles
              </Chip>
            </Grupo>
          </div>

          {hayFiltros && (
            <button
              onClick={() => {
                setQ('')
                setMusculos([])
                setElementos([])
                setEstadoVideo('')
                setSoloConVideo(false)
              }}
              style={e.limpiar}
            >
              Limpiar filtros
            </button>
          )}

          {error && <div style={e.error}>{error}</div>}

          <div style={e.grilla}>
            {resultados.map((ex) => (
              <button key={ex.id} onClick={() => setSeleccionado(ex)} style={e.tarjeta}>
                <div style={e.miniatura}>
                  {ex.poster_path ? (
                    <img src={mediaUrl(ex.poster_path)} alt="" style={e.miniaturaImg} />
                  ) : (
                    <span style={e.sinVideo}>sin video</span>
                  )}
                </div>
                <span style={e.nombre}>{ex.name}</span>
                <span style={e.meta}>
                  {[ex.code, ex.musculo, ex.patron].filter(Boolean).join(' · ')}
                </span>
                {ex.elementos?.length > 0 && (
                  <span style={e.elementos}>{ex.elementos.join(', ')}</span>
                )}
              </button>
            ))}
            {!cargando && resultados.length === 0 && (
              <p style={e.vacio}>Ningún ejercicio coincide con esos filtros.</p>
            )}
          </div>
        </>
      )}

      {verCobertura && (
        <div style={e.tablaEnvoltorio}>
          <p style={e.sub}>
            Por patrón de movimiento y rol en la sesión. Lo que está en rojo es lo que falta
            filmar: sin video, el motor no puede servir ese ejercicio aunque esté clasificado.
          </p>
          <table style={e.tabla}>
            <thead>
              <tr>
                <th style={e.th}>Patrón</th>
                <th style={e.th}>Rol</th>
                <th style={e.th}>Con video</th>
                <th style={e.th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {cobertura.map((c) => (
                <tr key={`${c.patron}-${c.rol}`}>
                  <td style={e.td}>{c.patron}</td>
                  <td style={e.td}>{c.rol}</td>
                  <td style={{ ...e.td, color: c.listos === 0 ? '#B91C1C' : '#065F46', fontWeight: 600 }}>
                    {c.listos}
                  </td>
                  <td style={e.td}>{c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={e.nota}>
            Falta cruzar esto por box: el mapa de qué material hay en cada box todavía no
            está cargado en la base, vive en el catalogador.
          </p>
        </div>
      )}

      {seleccionado && (
        <div style={e.fondo} onClick={() => setSeleccionado(null)}>
          <div style={e.panel} onClick={(ev) => ev.stopPropagation()}>
            <EncuadreEditor
              ejercicio={seleccionado}
              onCerrar={() => setSeleccionado(null)}
              onGuardado={(actualizado) => {
                setSeleccionado(actualizado)
                setResultados((rs) => rs.map((r) => (r.id === actualizado.id ? { ...r, ...actualizado } : r)))
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Grupo({ titulo, children }) {
  return (
    <div style={e.grupo}>
      <span style={e.grupoTitulo}>{titulo}</span>
      <div style={e.chips}>{children}</div>
    </div>
  )
}

function Chip({ activo, onClick, children }) {
  return (
    <button onClick={onClick} style={{ ...e.chip, ...(activo ? e.chipActivo : {}) }}>
      {children}
    </button>
  )
}

const e = {
  pagina: { padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1280, margin: '0 auto' },
  encabezado: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  h1: { margin: 0, fontSize: 24, fontWeight: 800, color: '#111827' },
  sub: { margin: '4px 0 0', fontSize: 14, color: '#6b7280' },
  buscador: {
    width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e5e7eb',
    fontSize: 15, outline: 'none',
  },
  filtros: { display: 'flex', flexDirection: 'column', gap: 12 },
  grupo: { display: 'flex', flexDirection: 'column', gap: 6 },
  grupoTitulo: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#9ca3af' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: '5px 11px', borderRadius: 999, border: '1px solid #e5e7eb', background: 'white',
    fontSize: 13, cursor: 'pointer', color: '#374151',
  },
  chipActivo: { background: '#FFF1ED', borderColor: '#F45F37', color: '#B33204', fontWeight: 600 },
  limpiar: {
    alignSelf: 'flex-start', border: 'none', background: 'transparent', color: '#F45F37',
    fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 600,
  },
  grilla: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 },
  tarjeta: {
    display: 'flex', flexDirection: 'column', gap: 4, padding: 10, borderRadius: 14,
    border: '1px solid #e5e7eb', background: 'white', textAlign: 'left', cursor: 'pointer',
  },
  miniatura: {
    aspectRatio: '16 / 10', borderRadius: 10, background: '#f3f4f6', overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  miniaturaImg: { width: '100%', height: '100%', objectFit: 'cover' },
  sinVideo: { fontSize: 12, color: '#9ca3af' },
  nombre: { fontSize: 14, fontWeight: 600, color: '#111827', lineHeight: 1.3 },
  meta: { fontSize: 12, color: '#6b7280' },
  elementos: { fontSize: 11, color: '#9ca3af' },
  vacio: { gridColumn: '1 / -1', textAlign: 'center', color: '#9ca3af', padding: 32 },
  error: { padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 13 },
  tablaEnvoltorio: { display: 'flex', flexDirection: 'column', gap: 10 },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #F45F37', fontSize: 12, textTransform: 'uppercase', color: '#B33204', letterSpacing: '.05em' },
  td: { padding: '8px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151' },
  nota: { fontSize: 12, color: '#9ca3af', margin: 0 },
  fondo: {
    position: 'fixed', inset: 0, background: 'rgba(17,24,39,.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50,
  },
  panel: {
    background: 'white', borderRadius: 18, padding: 20, width: 'min(560px, 100%)',
    maxHeight: '90vh', overflowY: 'auto',
  },
  botonSecundario: {
    padding: '10px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white',
    color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
  },
}
