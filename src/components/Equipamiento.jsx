import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { boxLabel } from '../services/queueService'

// What each box has, and what it is missing.
//
// The map was imported once from the catalogador and never had a way to be kept. That shows:
// half the boxes hold nothing, and because availability is a subset test — an exercise runs in
// a box when everything it needs is there — a box with no equipment matches only the exercises
// that need none. 28 of 309. The engine cannot serve those boxes anything else.
//
// So the screen leads with the consequence, not the inventory: every box shows how many
// exercises it can actually run, and every material shows what it is worth. Checking a box's
// equipment is data entry; seeing that a colchoneta would unlock 35 exercises in Estación 6 is
// a reason to walk over and put one there.

export default function Equipamiento() {
  const [boxes, setBoxes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [abierto, setAbierto] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('boxes_equipamiento')
        .select('*')
        .order('line_number', { nullsFirst: false })
        .order('box_number')
      if (err) throw err
      setBoxes(data || [])
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Boxes belong to a línea, and a box with no línea is not decoration — it is a station the
  // queue never sends anyone to. Grouping makes both facts visible at once.
  const porLinea = useMemo(() => {
    const grupos = new Map()
    for (const b of boxes) {
      const clave = b.linea ?? '__sin_linea__'
      if (!grupos.has(clave)) grupos.set(clave, { linea: b.linea, boxes: [] })
      grupos.get(clave).boxes.push(b)
    }
    return [...grupos.values()]
  }, [boxes])

  const vacios = boxes.filter((b) => b.elementos.length === 0).length

  const alGuardar = (fila) =>
    setBoxes((bs) => bs.map((b) => (b.id === fila.id ? { ...b, ...fila } : b)))

  return (
    <div style={e.pagina}>
      <div style={e.encabezado}>
        <div>
          <h1 style={e.h1}>Equipamiento por box</h1>
          <p style={e.sub}>
            {cargando ? 'Cargando…' : `${boxes.length} boxes · qué material tiene cada uno`}
          </p>
        </div>
      </div>

      {vacios > 0 && (
        <div style={e.aviso}>
          <strong>{vacios}</strong> {vacios === 1 ? 'box no tiene' : 'boxes no tienen'} material
          cargado. Un box sin material sólo puede correr los ejercicios que no necesitan nada —
          hoy son <strong>28</strong> de 309, y el motor de rutinas no le puede dar otra cosa.
        </div>
      )}

      {error && <div style={e.error}>{error}</div>}

      {porLinea.map((g) => (
        <div key={g.linea ?? 'sin'} style={e.grupo}>
          <span style={e.grupoTitulo}>{g.linea ?? 'Sin línea asignada'}</span>
          <div style={e.grilla}>
            {g.boxes.map((b) => (
              <Tarjeta key={b.id} box={b} onAbrir={() => setAbierto(b)} />
            ))}
          </div>
        </div>
      ))}

      {abierto && (
        <div style={e.fondo} onClick={() => setAbierto(null)}>
          <div style={e.panel} onClick={(ev) => ev.stopPropagation()}>
            <EditorBox
              box={abierto}
              boxes={boxes}
              onGuardado={(fila) => {
                alGuardar(fila)
                setAbierto((a) => (a && a.id === fila.id ? { ...a, ...fila } : a))
              }}
              onCopiado={cargar}
              onCerrar={() => setAbierto(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Same label the monitor and the TV use: the global box_number is an FK detail, what the gym
// says out loud is "B3".
const etiqueta = (box) =>
  box.line_number ? boxLabel(box.line_number, box.line_position) : box.name

function Tarjeta({ box, onAbrir }) {
  const vacio = box.elementos.length === 0
  return (
    <button onClick={onAbrir} style={{ ...e.tarjeta, ...(vacio ? e.tarjetaVacia : {}) }}>
      <span style={e.nombre}>{etiqueta(box)}</span>
      <span style={{ ...e.cuenta, ...(vacio ? e.cuentaVacia : {}) }}>
        {box.ejercicios_posibles} ejercicios
      </span>
      <span style={e.materiales}>
        {vacio ? 'Sin material cargado' : box.elementos.join(', ')}
      </span>
    </button>
  )
}

function EditorBox({ box, boxes, onGuardado, onCopiado, onCerrar }) {
  const [impacto, setImpacto] = useState([])
  const [seleccion, setSeleccion] = useState(box.elementos)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)
  const [copiarDe, setCopiarDe] = useState('')

  const cargarImpacto = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('impacto_elementos_box', { p_box_id: box.id })
    if (err) setError(err.message)
    else setImpacto(data || [])
  }, [box.id])

  useEffect(() => {
    setSeleccion(box.elementos)
    setGuardado(false)
    setError(null)
    cargarImpacto()
  }, [box.id, box.elementos, cargarImpacto])

  const alternar = (nombre) => {
    setSeleccion((s) => (s.includes(nombre) ? s.filter((n) => n !== nombre) : [...s, nombre]))
    setGuardado(false)
  }

  const sucio = useMemo(() => {
    const a = [...seleccion].sort().join('|')
    const b = [...box.elementos].sort().join('|')
    return a !== b
  }, [seleccion, box.elementos])

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('guardar_box_elementos', {
        p_box_id: box.id,
        p_elementos: seleccion,
      })
      if (err) throw err
      setGuardado(true)
      onGuardado?.({ id: box.id, elementos: [...seleccion].sort(), ejercicios_posibles: data })
      // The worth of every other material moved with the save, so the list has to be re-asked
      // rather than patched: what a polea unlocks depends on what else is in the box.
      cargarImpacto()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setGuardando(false)
    }
  }

  const copiar = async () => {
    if (!copiarDe) return
    setGuardando(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('copiar_equipamiento_box', {
        p_desde: Number(copiarDe),
        p_hacia: box.id,
      })
      if (err) throw err
      setCopiarDe('')
      onCopiado?.()
      onCerrar?.()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setGuardando(false)
    }
  }

  const tiene = impacto.filter((i) => seleccion.includes(i.elemento))
  const faltan = impacto.filter((i) => !seleccion.includes(i.elemento))

  return (
    <div style={e.contenedor}>
      <div style={e.panelEncabezado}>
        <div>
          <h3 style={e.titulo}>{etiqueta(box)}</h3>
          <span style={e.codigo}>
            {box.linea ?? 'Sin línea'} · {box.ejercicios_posibles} ejercicios posibles
          </span>
        </div>
        <button onClick={onCerrar} style={e.cerrar} aria-label="Cerrar">✕</button>
      </div>

      <Campo etiqueta="Tiene" ayuda="El número es cuántos ejercicios se perderían si lo sacás.">
        {tiene.length === 0 ? (
          <p style={e.vacio}>Todavía no tiene nada cargado.</p>
        ) : (
          <div style={e.chips}>
            {tiene.map((i) => (
              <Chip key={i.elemento} activo onClick={() => alternar(i.elemento)}>
                {i.elemento}
                <span style={e.chipNota}>−{i.ejercicios}</span>
              </Chip>
            ))}
          </div>
        )}
      </Campo>

      <Campo
        etiqueta="No tiene"
        ayuda="Cuántos ejercicios desbloquearía. Un material en cero es porque sus ejercicios necesitan además algo que este box no tiene — el material solo no alcanza."
      >
        <div style={e.chips}>
          {faltan.map((i) => (
            <Chip key={i.elemento} onClick={() => alternar(i.elemento)}>
              {i.elemento}
              {i.ejercicios > 0 && <span style={e.chipNotaSuma}>+{i.ejercicios}</span>}
            </Chip>
          ))}
        </div>
      </Campo>

      {error && <div style={e.error}>{error}</div>}

      <div style={e.acciones}>
        <select
          value={copiarDe}
          onChange={(ev) => setCopiarDe(ev.target.value)}
          style={e.select}
          disabled={guardando}
        >
          <option value="">Copiar de otro box…</option>
          {boxes
            .filter((b) => b.id !== box.id && b.elementos.length > 0)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {etiqueta(b)} ({b.elementos.length} materiales)
              </option>
            ))}
        </select>
        {copiarDe ? (
          <button onClick={copiar} disabled={guardando} style={e.botonPrimario}>
            {guardando ? 'Copiando…' : 'Copiar acá'}
          </button>
        ) : (
          <button onClick={guardar} disabled={guardando || !sucio} style={e.botonPrimario}>
            {guardando ? 'Guardando…' : guardado && !sucio ? 'Guardado ✓' : 'Guardar'}
          </button>
        )}
      </div>
    </div>
  )
}

function Campo({ etiqueta, ayuda, children }) {
  return (
    <div style={e.campo}>
      <span style={e.campoEtiqueta}>{etiqueta}</span>
      {children}
      {ayuda && <span style={e.campoAyuda}>{ayuda}</span>}
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
  pagina: { padding: 24, display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1280, margin: '0 auto' },
  encabezado: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  h1: { margin: 0, fontSize: 24, fontWeight: 800, color: '#111827' },
  sub: { margin: '4px 0 0', fontSize: 14, color: '#6b7280' },
  aviso: {
    padding: '10px 12px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A',
    color: '#92400E', fontSize: 13, lineHeight: 1.45,
  },
  grupo: { display: 'flex', flexDirection: 'column', gap: 8 },
  grupoTitulo: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#9ca3af' },
  grilla: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 },
  tarjeta: {
    display: 'flex', flexDirection: 'column', gap: 4, padding: 14, borderRadius: 14,
    border: '1px solid #e5e7eb', background: 'white', textAlign: 'left', cursor: 'pointer',
  },
  tarjetaVacia: { borderColor: '#FDE68A', background: '#FFFBEB' },
  nombre: { fontSize: 15, fontWeight: 700, color: '#111827' },
  cuenta: { fontSize: 13, fontWeight: 600, color: '#065F46' },
  cuentaVacia: { color: '#92400E' },
  materiales: { fontSize: 11, color: '#9ca3af', lineHeight: 1.4 },
  contenedor: { display: 'flex', flexDirection: 'column', gap: 16 },
  panelEncabezado: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  titulo: { margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' },
  codigo: { fontSize: 12, color: '#6b7280' },
  cerrar: { border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#6b7280' },
  campo: { display: 'flex', flexDirection: 'column', gap: 6 },
  campoEtiqueta: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#9ca3af' },
  campoAyuda: { fontSize: 12, color: '#9ca3af', lineHeight: 1.4 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: '5px 11px', borderRadius: 999, border: '1px solid #e5e7eb', background: 'white',
    fontSize: 13, cursor: 'pointer', color: '#374151', display: 'inline-flex',
    alignItems: 'baseline', gap: 5,
  },
  chipActivo: { background: '#FFF1ED', borderColor: '#F45F37', color: '#B33204', fontWeight: 600 },
  chipNota: { fontSize: 11, color: '#B91C1C', fontWeight: 600 },
  chipNotaSuma: { fontSize: 11, color: '#059669', fontWeight: 600 },
  vacio: { margin: 0, fontSize: 13, color: '#9ca3af' },
  select: {
    padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white',
    fontSize: 14, color: '#374151', cursor: 'pointer',
  },
  acciones: {
    display: 'flex', gap: 10, position: 'sticky', bottom: -20, background: 'white',
    padding: '12px 0 20px', marginBottom: -20, borderTop: '1px solid #f3f4f6',
    boxShadow: '0 -10px 14px -10px rgba(17,24,39,.14)',
  },
  botonPrimario: {
    flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#F45F37',
    color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
  },
  error: {
    padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA',
    color: '#B91C1C', fontSize: 13,
  },
  fondo: {
    position: 'fixed', inset: 0, background: 'rgba(17,24,39,.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50,
  },
  panel: {
    background: 'white', borderRadius: 18, padding: 20, width: 'min(680px, 100%)',
    maxHeight: '90vh', overflowY: 'auto',
  },
}
