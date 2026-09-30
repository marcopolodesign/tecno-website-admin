// Materiales (elementos) de una estación como chips ícono + nombre, para el "hola" y la
// explicación de la TV: que el socio junte lo que va a usar antes de que arranque el reloj.
// Los nombres vienen de `elementos.nombre` (catálogo del admin, pestaña Equipamiento).
// Íconos: SVG de trazo en línea, sin emojis; los no mapeados usan uno genérico.

const T = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

const ICONOS = {
  kettlebell: <><path d="M8.6 10.5V8a3.4 3.4 0 0 1 6.8 0v2.5" /><circle cx="12" cy="15.2" r="5.2" /></>,
  mancuernas: <><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" /></>,
  banda: <><path d="M4 12c0-4 3-7 8-7s8 3 8 7-3 7-8 7-8-3-8-7z" /><path d="M8 12c0-2 1.6-3.5 4-3.5s4 1.5 4 3.5" /></>,
  cajon: <><path d="M4 9l8-4 8 4v9l-8 3-8-3z" /><path d="M4 9l8 3 8-3M12 12v9" /></>,
  colchoneta: <><rect x="3" y="9" width="18" height="6" rx="3" /><path d="M8 9v6" /></>,
  sandbag: <><path d="M6 8c0-1.7 2.7-3 6-3s6 1.3 6 3v9c0 1.7-2.7 3-6 3s-6-1.3-6-3z" /><path d="M6 8c0 1.7 2.7 3 6 3s6-1.3 6-3" /></>,
  step: <><path d="M3 17h18v3H3z" /><path d="M6 17v-4h12v4M9 13V9h6v4" /></>,
  barra: <><path d="M2 12h20M5 7v10M8 9v6M16 9v6M19 7v10" /></>,
  banco: <><path d="M3 10h18v4H3zM6 14v5M18 14v5M3 10V8" /></>,
  polea: <><circle cx="12" cy="9" r="4" /><path d="M12 5V2M8 9H5v10M16 9v10" /><path d="M14.5 19h3" /></>,
  pelota: <><circle cx="12" cy="12" r="8" /><path d="M4 12c3-2 5-2 8 0s5 2 8 0" /></>,
  soga: <><path d="M6 4c0 8 12 8 12 16" /><rect x="4" y="3" width="4" height="5" rx="1" /><rect x="16" y="16" width="4" height="5" rx="1" /></>,
  disco: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /></>,
  rueda: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="1.5" /><path d="M2 12h3M19 12h3" /></>,
  sliders: <><ellipse cx="8" cy="14" rx="5" ry="3" /><ellipse cx="16" cy="10" rx="5" ry="3" /></>,
  tobillera: <><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M12 14v4M9 20h6" /></>,
  escalera: <><path d="M6 3v18M18 3v18M6 7h12M6 12h12M6 17h12" /></>,
  landmine: <><path d="M4 20h7" /><path d="M7.5 20L18 5" /><circle cx="18" cy="5" r="1.6" /></>,
  generico: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M9 12h6M12 9v6" /></>,
}

// nombre normalizado (minúsculas, sin tildes) -> { icono, label }. Los nombres del catálogo
// tienen erratas ("Keteball", "Medicin ball"): el label mostrado es el bien escrito.
const CATALOGO = [
  [/keteball|kettlebell|pesa rusa/, 'kettlebell', 'Kettlebell'],
  [/mancuerna/, 'mancuernas', 'Mancuernas'],
  [/banda/, 'banda', null],
  [/cajon/, 'cajon', 'Cajón'],
  [/colchoneta/, 'colchoneta', 'Colchoneta'],
  [/sand ?bag|bolsa de arena/, 'sandbag', 'Sand bag'],
  [/^step/, 'step', 'Step'],
  [/barra/, 'barra', null],
  [/banco/, 'banco', 'Banco'],
  [/polea/, 'polea', null],
  [/fit ?ball|medicin|pelota|bozu/, 'pelota', null],
  [/soga/, 'soga', 'Soga de box'],
  [/disco/, 'disco', 'Disco'],
  [/rueda/, 'rueda', 'Rueda abdominal'],
  [/slider/, 'sliders', 'Sliders'],
  [/tobillera/, 'tobillera', 'Tobillera'],
  [/escalera/, 'escalera', 'Escalera de coordinación'],
  [/landmine/, 'landmine', 'Landmine'],
]

const ACENTOS = { 'Banda elastica': 'Banda elástica', 'Medicin ball': 'Medicine ball', 'Banda arnes': 'Banda arnés', 'Banda asistencia': 'Banda de asistencia' }

function normalizar(nombre) {
  return String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function infoElemento(nombre) {
  const n = normalizar(nombre)
  const hit = CATALOGO.find(([re]) => re.test(n))
  const crudo = String(nombre || '').trim()
  const label = hit?.[2] || ACENTOS[crudo] || (crudo === crudo.toUpperCase() ? crudo.charAt(0) + crudo.slice(1).toLowerCase() : crudo)
  return { icono: hit ? hit[1] : 'generico', label }
}

export function IconoElemento({ nombre, size = 36 }) {
  const { icono } = infoElemento(nombre)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...T} aria-hidden="true">
      {ICONOS[icono] || ICONOS.generico}
    </svg>
  )
}

export function ChipsElementos({ elementos = [], titulo = 'Vas a necesitar', size = 'grande', color = '#ffffff' }) {
  if (!elementos.length) return null
  const g = size === 'grande'
  return (
    <div data-testid="chips-elementos" style={{ display: 'flex', flexDirection: 'column', alignItems: g ? 'center' : 'flex-start', gap: g ? 18 : 12 }}>
      {titulo && (
        <span style={{ fontSize: g ? 28 : 22, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>{titulo}</span>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: g ? 'center' : 'flex-start', gap: g ? 18 : 14 }}>
        {elementos.map((nombre) => (
          <span
            key={nombre}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: g ? 14 : 10, padding: g ? '14px 28px 14px 20px' : '10px 22px 10px 16px',
              borderRadius: 60, background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.22)', color,
              fontSize: g ? 38 : 28, fontWeight: 600, lineHeight: 1,
            }}
          >
            <IconoElemento nombre={nombre} size={g ? 44 : 32} />
            {infoElemento(nombre).label}
          </span>
        ))}
      </div>
    </div>
  )
}
