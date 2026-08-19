import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// The form for a catalog exercise — the way in for everything the importer and the filming
// pipeline cannot cover: a movement the gym invents, a classification that turned out wrong,
// and the rows that predate the catalog and carry no facets at all.
//
// It saves through `guardar_ejercicio` rather than writing the tables, because an exercise is
// two tables — the row and its equipment — and half of it landing is worse than none: the
// equipment list is what `ejercicios_para_box` subsets against, so a partial save makes a box
// offer movements it cannot run.
//
// The classification is not paperwork. Pattern is what the substitution engine rotates on and
// muscle is what the catalog groups by, so an exercise missing either is invisible to both.
// That is why those two are the only ones the form insists on and why it says what happens if
// they are left empty, rather than just refusing to save.

// Split by what the rest of the system actually reads. The first group is what makes an
// exercise usable — findable, substitutable, servable to a box — so it is always on screen.
// The second describes it more precisely and nothing breaks without it, so it is folded away:
// the common jobs here are "load a movement someone invented" and "classify a row that has
// nothing", and neither should mean scrolling past eleven groups of chips.
const ESENCIAL = {
  tipo: {
    etiqueta: 'Tipo',
    opciones: ['Ejercicio', 'Entrada en calor', 'Cooldown', 'Movilidad', 'Test'],
    ayuda: 'Sólo los de tipo Ejercicio los sirve el motor a un box.',
  },
  patron: {
    etiqueta: 'Patrón de movimiento',
    opciones: ['EMP-H', 'EMP-V', 'TRA-H', 'TRA-V', 'ROD', 'CAD', 'UNI',
               'CORE-AE', 'CORE-AR', 'CORE-AL', 'LOC', 'AIS'],
    // Two exercises are interchangeable when they share the pattern, not the muscle.
    ayuda: 'Es la clave de sustitución: dos ejercicios se reemplazan entre sí cuando comparten patrón.',
  },
  musculo: {
    etiqueta: 'Músculo primario',
    opciones: ['Pecho', 'Dorsal', 'Hombro', 'Trapecio', 'Bíceps', 'Tríceps',
               'Cuádriceps', 'Isquiotibiales', 'Glúteo', 'Aductor/Abductor', 'Gemelo',
               'Recto abdominal', 'Oblicuos', 'Espinales', 'Sistémico'],
    ayuda: 'El segmento (tren superior / inferior / core) sale solo de acá — no se carga a mano.',
  },
  rol: {
    etiqueta: 'Rol en la sesión',
    opciones: ['Activación', 'Fuerza principal', 'Fuerza accesoria',
               'Metabólico', 'Core', 'Coordinación', 'Cooldown'],
  },
}

const DETALLE = {
  lateralidad: {
    etiqueta: 'Lateralidad',
    opciones: ['Bilateral', 'Unilateral alterno', 'Unilateral puro'],
  },
  posicion: {
    etiqueta: 'Posición',
    opciones: ['De pie', 'Sentado', 'Supino', 'Prono', 'Cuadrupedia', 'Suspendido', 'Desplazamiento'],
  },
  vector: {
    etiqueta: 'Vector de carga',
    opciones: ['Axial', 'Horizontal', 'Vertical', 'Rotacional', 'Corporal'],
  },
  impacto: {
    etiqueta: 'Impacto',
    opciones: ['Nulo', 'Bajo', 'Alto'],
  },
}

// The gym's own shorthand, spelled out so someone loading their first movement does not have
// to already know it. The stored value is always the code — it is what the whole base is
// classified with.
const PATRON_EN_CASTELLANO = {
  'EMP-H': 'empuje horizontal',
  'EMP-V': 'empuje vertical',
  'TRA-H': 'tracción horizontal',
  'TRA-V': 'tracción vertical',
  ROD: 'dominante de rodilla',
  CAD: 'dominante de cadera',
  UNI: 'unilateral de pierna',
  'CORE-AE': 'core anti-extensión',
  'CORE-AR': 'core anti-rotación',
  'CORE-AL': 'core anti-lateralización',
  LOC: 'locomoción',
  AIS: 'aislado',
}

const CONTRAINDICACIONES = ['Rodilla', 'Hombro', 'Lumbar', 'Cervical', 'Cardio', 'Embarazo']
const ESTADOS_VIDEO = ['Sin filmar', 'Filmado', 'Editado', 'Cargado']
const ESCALA = [1, 2, 3]

const VACIO = {
  name: '', tipo: 'Ejercicio', patron: '', rol: '', musculo: '', lateralidad: '',
  posicion: '', vector: '', impacto: '', intensidad_relativa: '', complejidad_tecnica: '',
  contraindicaciones: [], elementos: [], video_estado: 'Sin filmar', family_code: '',
  nota_interna: '', is_active: true,
}

function desdeFila(ej) {
  if (!ej) return VACIO
  return {
    name: ej.name ?? '',
    tipo: ej.tipo ?? 'Ejercicio',
    patron: ej.patron ?? '',
    rol: ej.rol ?? '',
    musculo: ej.musculo ?? '',
    lateralidad: ej.lateralidad ?? '',
    posicion: ej.posicion ?? '',
    vector: ej.vector ?? '',
    impacto: ej.impacto ?? '',
    intensidad_relativa: ej.intensidad_relativa ?? '',
    complejidad_tecnica: ej.complejidad_tecnica ?? '',
    contraindicaciones: ej.contraindicaciones ?? [],
    elementos: ej.elementos ?? [],
    video_estado: ej.video_estado ?? 'Sin filmar',
    family_code: ej.family_code ?? '',
    nota_interna: ej.nota_interna ?? '',
    is_active: ej.is_active ?? true,
  }
}

export default function EjercicioEditor({ ejercicio, opcionesElemento, onElementoNuevo, onGuardado, onCerrar }) {
  const esNuevo = !ejercicio?.id
  const [f, setF] = useState(() => desdeFila(ejercicio))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [guardado, setGuardado] = useState(false)
  const [materialNuevo, setMaterialNuevo] = useState('')
  const [agregandoMaterial, setAgregandoMaterial] = useState(false)
  // Open from the start when the row already carries any of it: hiding a value someone
  // entered is worse than showing an extra section.
  const [verDetalle, setVerDetalle] = useState(() =>
    Boolean(ejercicio && Object.keys(DETALLE).some((c) => ejercicio[c]))
  )

  useEffect(() => {
    setF(desdeFila(ejercicio))
    setError(null)
    setGuardado(false)
    setVerDetalle(Boolean(ejercicio && Object.keys(DETALLE).some((c) => ejercicio[c])))
  }, [ejercicio?.id])

  const set = (campo) => (valor) => {
    setF((s) => ({ ...s, [campo]: valor }))
    setGuardado(false)
  }

  const alternar = (campo, valor) =>
    setF((s) => {
      const lista = s[campo]
      return { ...s, [campo]: lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor] }
    })

  // Said out loud rather than enforced. Someone loading twenty movements off a sheet should be
  // able to get the names in now and classify later — but not without knowing what it costs.
  const faltan = useMemo(
    () => [!f.patron && 'patrón', !f.musculo && 'músculo'].filter(Boolean),
    [f.patron, f.musculo]
  )

  const agregarMaterial = async () => {
    const nombre = materialNuevo.trim()
    if (!nombre) return
    setAgregandoMaterial(true)
    setError(null)
    try {
      // The database returns the catalog spelling, which may differ from what was typed —
      // "mancuernas" comes back "Mancuernas". Selecting what it returns is what keeps the
      // list from quietly splitting in two.
      const { data, error: err } = await supabase.rpc('agregar_elemento', { p_nombre: nombre })
      if (err) throw err
      onElementoNuevo?.(data)
      setF((s) => ({ ...s, elementos: s.elementos.includes(data) ? s.elementos : [...s.elementos, data] }))
      setMaterialNuevo('')
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setAgregandoMaterial(false)
    }
  }

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const nulo = (v) => (v === '' || v === undefined ? null : v)
      const { data, error: err } = await supabase.rpc('guardar_ejercicio', {
        p_id: ejercicio?.id ?? null,
        p_name: f.name,
        p_tipo: nulo(f.tipo),
        p_patron: nulo(f.patron),
        p_rol: nulo(f.rol),
        p_musculo: nulo(f.musculo),
        p_lateralidad: nulo(f.lateralidad),
        p_posicion: nulo(f.posicion),
        p_vector: nulo(f.vector),
        p_impacto: nulo(f.impacto),
        p_intensidad: nulo(f.intensidad_relativa),
        p_complejidad: nulo(f.complejidad_tecnica),
        p_contraindicaciones: f.contraindicaciones,
        p_elementos: f.elementos,
        p_video_estado: nulo(f.video_estado),
        p_family_code: nulo(f.family_code.trim()),
        p_nota_interna: nulo(f.nota_interna.trim()),
        p_is_active: f.is_active,
      })
      if (err) throw err
      setGuardado(true)
      onGuardado?.(data, esNuevo)
    } catch (err) {
      // The real message, always: the database says "Este material no está en la lista:
      // Trineo", which is something the person loading the catalog can act on. "No se pudo
      // guardar" is not.
      setError(err.message || String(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={s.contenedor}>
      <Campo etiqueta="Nombre">
        <input
          value={f.name}
          onChange={(ev) => set('name')(ev.target.value)}
          placeholder="Sentadilla búlgara con keteball"
          style={s.input}
          autoFocus={esNuevo}
        />
      </Campo>

      {Object.entries(ESENCIAL).map(([campo, def]) => (
        <GrupoChips key={campo} campo={campo} def={def} valor={f[campo]} onElegir={set(campo)} />
      ))}

      <Campo
        etiqueta="Material"
        ayuda="Todo lo que hace falta para hacerlo. Un box puede servir el ejercicio sólo si tiene todo esto."
      >
        <div style={s.chips}>
          {opcionesElemento.map((el) => (
            <Chip key={el} activo={f.elementos.includes(el)} onClick={() => alternar('elementos', el)}>
              {el}
            </Chip>
          ))}
        </div>
        <div style={s.filaMaterial}>
          <input
            value={materialNuevo}
            onChange={(ev) => setMaterialNuevo(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key !== 'Enter') return
              ev.preventDefault()
              agregarMaterial()
            }}
            placeholder="¿Falta un material? Escribilo y agregalo"
            style={{ ...s.input, flex: 1 }}
          />
          <button
            onClick={agregarMaterial}
            disabled={agregandoMaterial || !materialNuevo.trim()}
            style={s.botonSecundario}
          >
            {agregandoMaterial ? 'Agregando…' : 'Agregar material'}
          </button>
        </div>
      </Campo>

      <Campo etiqueta="Estado del video">
        <div style={s.chips}>
          {ESTADOS_VIDEO.map((v) => (
            <Chip key={v} activo={f.video_estado === v} onClick={() => set('video_estado')(v)}>
              {v}
            </Chip>
          ))}
        </div>
      </Campo>

      <button onClick={() => setVerDetalle((v) => !v)} style={s.desplegar}>
        {verDetalle ? '− Menos detalle' : '+ Más detalle'}
        <span style={s.desplegarNota}>
          lateralidad, posición, vector, impacto, intensidad, contraindicaciones, familia, nota
        </span>
      </button>

      {verDetalle && (
        <>
          {Object.entries(DETALLE).map(([campo, def]) => (
            <GrupoChips key={campo} campo={campo} def={def} valor={f[campo]} onElegir={set(campo)} />
          ))}

          <div style={s.dosColumnas}>
            <Campo etiqueta="Intensidad relativa">
              <div style={s.chips}>
                {ESCALA.map((n) => (
                  <Chip
                    key={n}
                    activo={String(f.intensidad_relativa) === String(n)}
                    onClick={() => set('intensidad_relativa')(String(f.intensidad_relativa) === String(n) ? '' : n)}
                  >
                    {n}
                  </Chip>
                ))}
              </div>
            </Campo>
            <Campo etiqueta="Complejidad técnica">
              <div style={s.chips}>
                {ESCALA.map((n) => (
                  <Chip
                    key={n}
                    activo={String(f.complejidad_tecnica) === String(n)}
                    onClick={() => set('complejidad_tecnica')(String(f.complejidad_tecnica) === String(n) ? '' : n)}
                  >
                    {n}
                  </Chip>
                ))}
              </div>
            </Campo>
          </div>

          <Campo etiqueta="Contraindicaciones" ayuda="Qué lesión o condición desaconseja este movimiento.">
            <div style={s.chips}>
              {CONTRAINDICACIONES.map((c) => (
                <Chip key={c} activo={f.contraindicaciones.includes(c)} onClick={() => alternar('contraindicaciones', c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </Campo>

          <Campo etiqueta="Familia" ayuda="Mismo movimiento base con otro implemento. Sólo agrupa: el video es uno por ejercicio.">
            <input
              value={f.family_code}
              onChange={(ev) => set('family_code')(ev.target.value)}
              placeholder="ROD_SENTADILLA"
              style={s.input}
            />
          </Campo>

          <Campo etiqueta="Nota interna" ayuda="Para quien lo filma o lo vuelve a clasificar. No la ve el socio.">
            <textarea
              value={f.nota_interna}
              onChange={(ev) => set('nota_interna')(ev.target.value)}
              rows={2}
              style={{ ...s.input, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Campo>

          <label style={s.checkbox}>
            <input type="checkbox" checked={f.is_active} onChange={(ev) => set('is_active')(ev.target.checked)} />
            <span>
              Activo
              <span style={s.checkboxNota}>
                {' '}— si lo desactivás deja de aparecer en el catálogo y el motor no lo sirve. No se borra.
              </span>
            </span>
          </label>
        </>
      )}

      {faltan.length > 0 && (
        <div style={s.aviso}>
          Sin {faltan.join(' ni ')} el ejercicio se guarda igual, pero queda como
          <strong> sin clasificar</strong>: no lo encuentra ningún filtro y el motor de rutinas
          no lo puede servir.
        </div>
      )}

      {esNuevo && (
        <p style={s.nota}>
          Al guardarlo recibe su código de catálogo, así que desde ese momento se le puede
          subir el video por el mismo camino de siempre.
        </p>
      )}

      {error && <div style={s.error}>{error}</div>}

      <div style={s.acciones}>
        {onCerrar && (
          <button onClick={onCerrar} disabled={guardando} style={s.botonSecundario}>
            Cancelar
          </button>
        )}
        <button onClick={guardar} disabled={guardando || !f.name.trim()} style={s.botonPrimario}>
          {guardando ? 'Guardando…' : guardado ? 'Guardado ✓' : esNuevo ? 'Crear ejercicio' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

function GrupoChips({ campo, def, valor, onElegir }) {
  return (
    <Campo etiqueta={def.etiqueta} ayuda={def.ayuda}>
      <div style={s.chips}>
        {def.opciones.map((o) => (
          <Chip key={o} activo={valor === o} onClick={() => onElegir(valor === o ? '' : o)}>
            {o}
            {campo === 'patron' && PATRON_EN_CASTELLANO[o] && (
              <span style={s.chipNota}>{PATRON_EN_CASTELLANO[o]}</span>
            )}
          </Chip>
        ))}
      </div>
    </Campo>
  )
}

function Campo({ etiqueta, ayuda, children }) {
  return (
    <div style={s.campo}>
      <span style={s.campoEtiqueta}>{etiqueta}</span>
      {children}
      {ayuda && <span style={s.campoAyuda}>{ayuda}</span>}
    </div>
  )
}

function Chip({ activo, onClick, children }) {
  return (
    <button onClick={onClick} style={{ ...s.chip, ...(activo ? s.chipActivo : {}) }}>
      {children}
    </button>
  )
}

const s = {
  contenedor: { display: 'flex', flexDirection: 'column', gap: 16 },
  encabezado: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  titulo: { margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' },
  codigo: { fontSize: 12, fontFamily: 'monospace', color: '#6b7280' },
  cerrar: { border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: '#6b7280' },
  campo: { display: 'flex', flexDirection: 'column', gap: 6 },
  campoEtiqueta: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#9ca3af' },
  campoAyuda: { fontSize: 12, color: '#9ca3af', lineHeight: 1.4 },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e5e7eb',
    fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111827',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    padding: '5px 11px', borderRadius: 999, border: '1px solid #e5e7eb', background: 'white',
    fontSize: 13, cursor: 'pointer', color: '#374151', display: 'inline-flex',
    alignItems: 'baseline', gap: 5,
  },
  chipActivo: { background: '#FFF1ED', borderColor: '#F45F37', color: '#B33204', fontWeight: 600 },
  chipNota: { fontSize: 11, color: '#9ca3af', fontWeight: 400 },
  filaMaterial: { display: 'flex', gap: 8, marginTop: 4 },
  dosColumnas: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  checkbox: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' },
  checkboxNota: { color: '#9ca3af' },
  aviso: {
    padding: '10px 12px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A',
    color: '#92400E', fontSize: 13, lineHeight: 1.45,
  },
  error: {
    padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA',
    color: '#B91C1C', fontSize: 13,
  },
  desplegar: {
    alignSelf: 'flex-start', border: 'none', background: 'transparent', color: '#F45F37',
    fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 600, textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  desplegarNota: { fontSize: 11, color: '#9ca3af', fontWeight: 400 },
  // Pinned so a long form never hides its own save button. It has to fully mask what scrolls
  // under it — a translucent bar with chips showing through reads as a rendering glitch.
  acciones: {
    display: 'flex', gap: 10, position: 'sticky', bottom: -20, background: 'white',
    padding: '12px 0 20px', marginBottom: -20, borderTop: '1px solid #f3f4f6',
    boxShadow: '0 -10px 14px -10px rgba(17,24,39,.14)',
  },
  botonPrimario: {
    flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', background: '#F45F37',
    color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
  },
  botonSecundario: {
    padding: '10px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white',
    color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  nota: { margin: 0, fontSize: 12, color: '#9ca3af' },
}
