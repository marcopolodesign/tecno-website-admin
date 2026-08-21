import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { boxLabel } from '../services/queueService'
import Sidecart from './Sidecart'

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

// Lo que puede entrenar una estación, con el nombre que usa el coach y no el código del catálogo.
// Es la misma lista cerrada con la que están clasificados los 296 ejercicios, así que declarar un
// objetivo acá y buscar por patrón allá hablan de lo mismo.
const PATRONES = [
  ['EMP-H', 'Empuje horizontal'],
  ['EMP-V', 'Empuje vertical'],
  ['TRA-H', 'Tracción horizontal'],
  ['TRA-V', 'Tracción vertical'],
  ['ROD', 'Rodilla dominante'],
  ['CAD', 'Cadera dominante'],
  ['UNI', 'Unilateral'],
  ['CORE-AE', 'Core anti-extensión'],
  ['CORE-AR', 'Core anti-rotación'],
  ['LOC', 'Locomoción'],
  ['AIS', 'Aislado'],
]

export default function Equipamiento() {
  const [boxes, setBoxes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [abierto, setAbierto] = useState(null)
  const [sumando, setSumando] = useState(null)

  // Una línea no tiene un largo fijo: es la lista de sus boxes. Sumar uno es sumar una fila, y
  // el gimnasio no debería necesitarnos para eso.
  const sumarBox = async (lineaId) => {
    setSumando(lineaId)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('agregar_box', { p_linea_id: lineaId })
      if (err) throw err
      await cargar()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSumando(null)
    }
  }

  const sumarLinea = async (sedeId) => {
    setSumando('linea')
    setError(null)
    try {
      const { error: err } = await supabase.rpc('agregar_linea', { p_sede_id: sedeId })
      if (err) throw err
      await cargar()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setSumando(null)
    }
  }

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
      const clave = b.linea_id ?? '__sin_linea__'
      if (!grupos.has(clave)) {
        grupos.set(clave, { lineaId: b.linea_id, linea: b.linea, sedeId: b.sede_id, boxes: [] })
      }
      grupos.get(clave).boxes.push(b)
    }
    return [...grupos.values()]
  }, [boxes])

  const vacios = boxes.filter((b) => b.elementos.length === 0).length
  const sedeId = boxes.find((b) => b.sede_id)?.sede_id ?? null

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
        <div key={g.lineaId ?? 'sin'} style={e.grupo}>
          <div style={e.grupoEncabezado}>
            <span style={e.grupoTitulo}>{g.linea ?? 'Sin línea asignada'}</span>
            <span style={e.grupoCuenta}>
              {g.boxes.length} {g.boxes.length === 1 ? 'estación' : 'estaciones'}
            </span>
            {g.lineaId && (
              <button
                type="button"
                onClick={() => sumarBox(g.lineaId)}
                disabled={sumando === g.lineaId}
                style={e.botonSumar}
              >
                {sumando === g.lineaId ? 'Agregando…' : '+ Estación'}
              </button>
            )}
          </div>
          <div style={e.grilla}>
            {g.boxes.map((b) => (
              <Tarjeta key={b.id} box={b} onAbrir={() => setAbierto(b)} />
            ))}
          </div>
        </div>
      ))}

      {sedeId && (
        <button
          type="button"
          onClick={() => sumarLinea(sedeId)}
          disabled={sumando === 'linea'}
          style={e.botonSumarLinea}
        >
          {sumando === 'linea' ? 'Agregando…' : '+ Agregar una línea'}
        </button>
      )}

      <Sidecart
        isOpen={Boolean(abierto)}
        onClose={() => setAbierto(null)}
        title={abierto ? etiqueta(abierto) : ''}
        subtitle={
          abierto
            ? `${abierto.linea ?? 'Sin línea'} · ${abierto.elementos.length} materiales · ${abierto.ejercicios_posibles} ejercicios posibles`
            : undefined
        }
        size="lg"
      >
        {abierto && (
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
        )}
      </Sidecart>
    </div>
  )
}

// Same label the monitor and the TV use: the global box_number is an FK detail, what the gym
// says out loud is "B3".
const etiqueta = (box) =>
  box.line_number ? boxLabel(box.line_number, box.line_position) : box.name

// The materials are the card. Someone checking this screen is standing on the floor comparing
// it to what is in front of them, item by item — the exercise count is the consequence, and a
// consequence belongs under the thing that causes it.
function Tarjeta({ box, onAbrir }) {
  const vacio = box.elementos.length === 0
  return (
    <button onClick={onAbrir} style={{ ...e.tarjeta, ...(vacio ? e.tarjetaVacia : {}) }}>
      <div style={e.tarjetaEncabezado}>
        <span style={e.nombre}>{etiqueta(box)}</span>
        <span style={e.cantidad}>
          {vacio ? 'sin material' : `${box.elementos.length} materiales`}
        </span>
      </div>

      {vacio ? (
        <span style={e.sinMaterial}>Sin material cargado</span>
      ) : (
        <ul style={e.listaMateriales}>
          {box.elementos.map((m) => (
            <li key={m} style={e.material}>{m}</li>
          ))}
        </ul>
      )}

      <div style={e.pie}>
        <span style={{ ...e.cuenta, ...(vacio ? e.cuentaVacia : {}) }}>
          {box.ejercicios_posibles} ejercicios
        </span>
        {box.objetivos?.length > 0 && (
          <span style={e.sello}>
            {box.objetivos.length === 1
              ? (PATRONES.find(([c]) => c === box.objetivos[0])?.[1] ?? box.objetivos[0])
              : `${box.objetivos.length} objetivos`}
          </span>
        )}
        {box.equipamiento_independiente ? (
          <span style={e.sello}>equipamiento propio</span>
        ) : box.desincronizado ? (
          <span style={e.selloAlerta}>distinto a su par</span>
        ) : null}
      </div>
    </button>
  )
}

function EditorBox({ box, boxes, onGuardado, onCopiado, onCerrar }) {
  const [impacto, setImpacto] = useState([])
  const [cambiandoSync, setCambiandoSync] = useState(false)
  const [seleccion, setSeleccion] = useState(box.elementos)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState(null)
  const [copiarDe, setCopiarDe] = useState('')
  const [objetivos, setObjetivos] = useState(box.objetivos || [])
  const [guardandoObjetivo, setGuardandoObjetivo] = useState(false)

  const cargarImpacto = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('impacto_elementos_box', { p_box_id: box.id })
    if (err) setError(err.message)
    else setImpacto(data || [])
  }, [box.id])

  useEffect(() => {
    setSeleccion(box.elementos)
    setObjetivos(box.objetivos || [])
    setError(null)
    cargarImpacto()
  }, [box.id, box.elementos, cargarImpacto])

  // Saving reloads the whole screen, because it may have written the sibling box too. That
  // reload arrives as a new `box` prop and used to wipe the confirmation with it — so the one
  // question the coach has after pressing the button, did it save, had no answer on screen.
  useEffect(() => {
    setGuardado(false)
  }, [box.id])

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
      // The save may have written more than this box, so the whole screen is re-read rather
      // than patching the one row: showing A1 updated and B1 stale would be worse than a
      // reload.
      onGuardado?.({ id: box.id, elementos: [...seleccion].sort(), ejercicios_posibles: data })
      if (!box.equipamiento_independiente) onCopiado?.()
      // The worth of every other material moved with the save, so the list has to be re-asked
      // rather than patched: what a polea unlocks depends on what else is in the box.
      cargarImpacto()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setGuardando(false)
    }
  }

  const alternarObjetivo = (p) =>
    setObjetivos((o) => (o.includes(p) ? o.filter((x) => x !== p) : [...o, p]))

  const objetivoSucio = useMemo(() => {
    const a = [...objetivos].sort().join('|')
    const b = [...(box.objetivos || [])].sort().join('|')
    return a !== b
  }, [objetivos, box.objetivos])

  const guardarObjetivo = async () => {
    setGuardandoObjetivo(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.rpc('guardar_box_objetivos', {
        p_box_id: box.id,
        p_objetivos: objetivos,
      })
      if (err) throw err
      onGuardado?.({ id: box.id, objetivos: [...objetivos], ejercicios_posibles: data })
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setGuardandoObjetivo(false)
    }
  }

  const cambiarSync = async () => {
    setCambiandoSync(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('marcar_equipamiento_independiente', {
        p_box_id: box.id,
        p_independiente: !box.equipamiento_independiente,
      })
      if (err) throw err
      // Rejoining the sync rewrites this box's equipment from its station, so the screen has
      // to be re-read rather than assumed.
      onCopiado?.()
      onCerrar?.()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setCambiandoSync(false)
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
      <div style={box.equipamiento_independiente ? e.syncPropio : e.syncEspejo}>
        <span style={e.syncTexto}>
          {box.equipamiento_independiente
            ? 'Este box tiene equipamiento propio: lo que cambies acá no toca a su par en la otra línea, y lo que cambien allá no lo toca a él.'
            : `Lo que guardes acá se copia a la estación ${box.line_position} de la otra línea. Las dos tienen el mismo material.`}
        </span>
        <button type="button" onClick={cambiarSync} disabled={cambiandoSync} style={e.syncBoton}>
          {cambiandoSync
            ? 'Cambiando…'
            : box.equipamiento_independiente
              ? 'Volver a sincronizar'
              : 'Darle equipamiento propio'}
        </button>
      </div>

      <Campo
        etiqueta="Qué entrena"
        ayuda="Sin nada marcado la estación acepta cualquier movimiento, que es como está el gym hoy. Marcar acota: el motor sólo le va a poner esos patrones."
      >
        <div style={e.chips}>
          {PATRONES.map(([codigo, nombre]) => (
            <Chip
              key={codigo}
              activo={objetivos.includes(codigo)}
              onClick={() => alternarObjetivo(codigo)}
            >
              {nombre}
            </Chip>
          ))}
        </div>
        {objetivoSucio && (
          <button
            type="button"
            onClick={guardarObjetivo}
            disabled={guardandoObjetivo}
            style={e.syncBoton}
          >
            {guardandoObjetivo ? 'Guardando…' : 'Guardar el objetivo'}
          </button>
        )}
      </Campo>

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
  grupoEncabezado: { display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 },
  grupoCuenta: { fontSize: 12, color: '#8A8178' },
  botonSumar: {
    marginLeft: 'auto', fontSize: 12, fontWeight: 600, padding: '5px 11px', borderRadius: 8,
    border: '1px solid #E5E7EB', background: '#fff', color: '#374151', cursor: 'pointer',
  },
  botonSumarLinea: {
    fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 10,
    border: '1px dashed #D1D5DB', background: 'transparent', color: '#6B7280', cursor: 'pointer',
  },
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
  tarjetaEncabezado: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  cantidad: { fontSize: 12, fontWeight: 600, color: '#6b7280' },
  listaMateriales: {
    listStyle: 'none', margin: '2px 0 0', padding: 0, display: 'flex', flexDirection: 'column',
    gap: 1,
  },
  material: { fontSize: 13, color: '#374151', lineHeight: 1.4 },
  sinMaterial: { fontSize: 13, color: '#92400E', fontWeight: 600 },
  pie: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    marginTop: 6, paddingTop: 6, borderTop: '1px solid #f3f4f6',
  },
  sello: {
    fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FFFBEB',
    border: '1px solid #FDE68A', borderRadius: 999, padding: '2px 7px',
  },
  selloAlerta: {
    fontSize: 10, fontWeight: 700, color: '#B91C1C', background: '#FEF2F2',
    border: '1px solid #FECACA', borderRadius: 999, padding: '2px 7px',
  },
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
  syncEspejo: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
    background: '#EFF6FF', border: '1px solid #BFDBFE',
  },
  syncPropio: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10,
    background: '#FFFBEB', border: '1px solid #FDE68A',
  },
  syncTexto: { flex: 1, fontSize: 12, color: '#374151', lineHeight: 1.45 },
  syncBoton: {
    border: '1px solid #e5e7eb', background: 'white', borderRadius: 8, padding: '6px 10px',
    fontSize: 12, fontWeight: 700, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap',
  },
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
