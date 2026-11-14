import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { queueService } from '../services/queueService'
import { sedeSlug, lineaLetra } from '../lib/slug'
import toast from 'react-hot-toast'

// Monitor de TVs (2026-11-14). Cada TV de la sala manda cada 10 s su foto (fase, socio, videos)
// y al instante sus eventos (carga, error, video trabado/ok, recarga) a tv_reportar() — ver el
// script inline de index.html. Esta pantalla los lee cada 3 s: sirve para ver EN VIVO qué TV falla
// y por qué, sin tener que mandar fotos. Abajo, las pruebas de sala con socios de prueba
// (prueba_sala(): ayer / videos / tabata).

const REFRESCO_MS = 3000
const SIN_SENAL_SEG = 25

const segDesde = (iso) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000)) : null)
const hace = (seg) => (seg == null ? '—' : seg < 60 ? `hace ${seg} s` : seg < 3600 ? `hace ${Math.round(seg / 60)} min` : `hace ${Math.round(seg / 3600)} h`)
const hora = (iso) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

const TIPOS = {
  error: { texto: 'Error', clase: 'bg-red-500/15 text-red-600' },
  sigue_cargando: { texto: 'No carga', clase: 'bg-red-500/15 text-red-600' },
  video_trabado: { texto: 'Video trabado', clase: 'bg-amber-500/15 text-amber-700' },
  recarga: { texto: 'Recarga', clase: 'bg-amber-500/15 text-amber-700' },
  video_ok: { texto: 'Video OK', clase: 'bg-emerald-500/15 text-emerald-700' },
  carga: { texto: 'Cargó', clase: 'bg-sky-500/15 text-sky-700' },
  fase: { texto: 'Pantalla', clase: 'bg-surface-secondary text-text-secondary' },
}

const FASES = { off: 'Libre', llegando: 'Llegando', explicacion: 'Explicación', preparate: 'Preparate', estacion: 'Entrenando', chau: 'Cambio de estación', resumen: 'Fin del circuito' }
const faseTexto = (f) => (f ? FASES[f] || f : '—')

function estadoVideo(v) {
  if (v.error) return { texto: `error ${v.error}`, clase: 'text-red-600' }
  if (v.trabado) return { texto: 'trabado', clase: 'text-amber-700' }
  if (v.corriendo && !v.paused) return { texto: `corre ${v.t}s`, clase: 'text-emerald-700' }
  if (v.readyState === 0) return { texto: v.networkState === 2 ? 'descargando…' : 'sin cargar', clase: 'text-text-tertiary' }
  if (v.paused) return { texto: 'en pausa', clase: 'text-text-tertiary' }
  return { texto: `cargando (${v.readyState})`, clase: 'text-text-tertiary' }
}

function Tarjeta({ titulo, fila, eventos, activa, onClick }) {
  const seg = segDesde(fila?.updated_at)
  const viva = seg != null && seg <= SIN_SENAL_SEG
  const ultimo = eventos.find((e) => e.tipo !== 'fase')
  const malo = ultimo && ['error', 'sigue_cargando', 'video_trabado', 'recarga'].includes(ultimo.tipo) && segDesde(ultimo.created_at) < 300
  const c = fila?.contadores || {}
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card w-full text-left p-3 space-y-2 transition-colors ${activa ? 'ring-2 ring-brand' : ''} ${malo ? 'bg-amber-500/5' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold text-text-primary">{titulo}</span>
        <span className={`inline-flex items-center gap-1.5 text-[11px] ${viva ? 'text-emerald-700' : 'text-text-tertiary'}`}>
          <span className={`h-2 w-2 rounded-full ${viva ? 'bg-emerald-500' : fila ? 'bg-red-500' : 'bg-border-default'}`} />
          {fila ? (viva ? 'en línea' : `sin señal · ${hace(seg)}`) : 'nunca reportó'}
        </span>
      </div>
      {fila && (
        <>
          <div className="text-xs text-text-secondary">
            <span className="font-medium text-text-primary">{faseTexto(fila.fase)}</span>
            {fila.socio ? ` · ${fila.socio}` : ''}
          </div>
          <div className="space-y-0.5">
            {(fila.videos || []).length === 0 && <div className="text-[11px] text-text-tertiary">sin videos en pantalla</div>}
            {(fila.videos || []).map((v, i) => {
              const e = estadoVideo(v)
              return (
                <div key={i} className="flex justify-between text-[11px] font-mono">
                  <span className="text-text-secondary">{v.codigo}</span>
                  <span className={e.clase}>{e.texto}</span>
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 text-[11px] text-text-tertiary">
            <span>videos ok {c.videos_ok ?? 0}</span>
            <span className={c.trabados ? 'text-amber-700' : ''}>trabados {c.trabados ?? 0}</span>
            <span className={c.errores ? 'text-red-600' : ''}>errores {c.errores ?? 0}</span>
            <span>cargada {hace(segDesde(fila.cargada_at))}</span>
          </div>
          {ultimo && (
            <div className="text-[11px] text-text-tertiary truncate">
              {hora(ultimo.created_at)} · {TIPOS[ultimo.tipo]?.texto || ultimo.tipo}: {ultimo.mensaje}
            </div>
          )}
          <div className="text-[10px] text-text-tertiary font-mono">{fila.version} · {fila.bundle}</div>
        </>
      )}
    </button>
  )
}

function Pruebas() {
  const [socios, setSocios] = useState([])
  const [n, setN] = useState(4)
  const [ocupado, setOcupado] = useState(false)
  const [confirmarLimpiar, setConfirmarLimpiar] = useState(false)

  const correr = useCallback(async (accion, escenario = null) => {
    setOcupado(true)
    try {
      const { data, error } = await supabase.rpc('prueba_sala', { p_accion: accion, p_escenario: escenario, p_n: n })
      if (error) throw error
      if (!data?.ok) throw new Error(data?.mensaje || 'No se pudo')
      if (accion === 'limpiar') {
        toast.success(`Pruebas borradas: ${data.socios} socios`)
        setSocios([])
      } else {
        setSocios(data.socios || [])
        if (accion === 'armar') toast.success(`Prueba "${escenario}" cargada: ${n} socios en la fila`)
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setOcupado(false)
      setConfirmarLimpiar(false)
    }
  }, [n])

  useEffect(() => {
    correr('estado')
    const id = setInterval(() => correr('estado'), 10000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const ESCENARIOS = [
    ['ayer', 'Como el 05/11', 'Tu rutina (sesión 2): todo Tabata, todos en la misma sesión.'],
    ['videos', 'Todos con video', 'Modalidades mezcladas; los ejercicios sin video se cambian por uno con video.'],
    ['tabata', 'Tabata + video', 'Todo Tabata 6 × 40/20 y todos los ejercicios con video.'],
  ]
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Pruebas de sala</h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            Carga socios de prueba con el ingreso hecho y en la fila. Cuando el sistema los llama, entran solos al box 1.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          Socios
          <select value={n} onChange={(e) => setN(Number(e.target.value))} className="form-input py-1 w-16">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {ESCENARIOS.map(([clave, titulo, detalle]) => (
          <button key={clave} type="button" disabled={ocupado} onClick={() => correr('armar', clave)}
            className="text-left rounded-lg bg-surface-secondary hover:bg-brand/10 p-3 disabled:opacity-50">
            <div className="text-sm font-medium text-text-primary">{titulo}</div>
            <div className="text-xs text-text-tertiary mt-0.5">{detalle}</div>
          </button>
        ))}
      </div>
      {socios.length > 0 && (
        <div className="space-y-1">
          {socios.map((s) => (
            <div key={s.email} className="flex flex-wrap justify-between gap-2 text-xs">
              <span className="text-text-primary font-medium">{s.nombre} <span className="text-text-tertiary font-normal">{s.email.replace('@tecnofit.test', '')}</span></span>
              <span className="text-text-secondary">
                {s.estado || 'terminó'}{s.posicion ? ` · pos ${s.posicion}` : ''} · {s.ejercicios} ejercicios · {s.sin_video} sin video · {s.formatos}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        {confirmarLimpiar ? (
          <span className="flex items-center gap-3 text-xs">
            <span className="text-text-secondary">¿Borrar todos los socios de prueba?</span>
            <button type="button" disabled={ocupado} onClick={() => correr('limpiar')} className="font-medium text-red-600">Sí, borrar</button>
            <button type="button" onClick={() => setConfirmarLimpiar(false)} className="text-text-tertiary">Cancelar</button>
          </span>
        ) : (
          <button type="button" disabled={ocupado} onClick={() => setConfirmarLimpiar(true)} className="text-xs font-medium text-text-secondary hover:text-red-600">
            Borrar socios de prueba
          </button>
        )}
      </div>
    </div>
  )
}

export default function MonitorTvs() {
  const [filas, setFilas] = useState([])
  const [eventos, setEventos] = useState([])
  const [lineas, setLineas] = useState([])
  const [filtro, setFiltro] = useState(null)
  const [error, setError] = useState(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    queueService.getLines().then(({ data }) => setLineas(data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    let vivo = true
    const leer = async () => {
      const [a, b] = await Promise.all([
        supabase.from('tv_estado').select('*'),
        supabase.from('tv_eventos').select('*').order('created_at', { ascending: false }).limit(200),
      ])
      if (!vivo) return
      if (a.error || b.error) { setError((a.error || b.error).message); return }
      setError(null)
      setFilas(a.data || [])
      setEventos(b.data || [])
      setTick((t) => t + 1)
    }
    leer()
    const id = setInterval(leer, REFRESCO_MS)
    return () => { vivo = false; clearInterval(id) }
  }, [])

  // Pantallas esperadas por sede: la de la fila + cada estación de cada línea.
  const sedes = useMemo(() => {
    const porSede = new Map()
    for (const l of lineas) {
      const slug = sedeSlug(l.locations?.name)
      if (!slug) continue
      if (!porSede.has(slug)) porSede.set(slug, { slug, nombre: l.locations.name, lineas: [] })
      porSede.get(slug).lineas.push({ letra: lineaLetra(l.line_number), capacidad: l.capacity || 5 })
    }
    return [...porSede.values()]
  }, [lineas])

  const porPantalla = useMemo(() => new Map(filas.map((f) => [f.pantalla, f])), [filas])
  const eventosDe = (id) => eventos.filter((e) => e.pantalla === id)
  const conocidas = new Set(sedes.flatMap((s) => [s.slug, ...s.lineas.flatMap((l) => Array.from({ length: l.capacidad }, (_, i) => `${s.slug}/${l.letra}/${i + 1}`))]))
  const otras = filas.filter((f) => !conocidas.has(f.pantalla))
  const lista = filtro ? eventosDe(filtro) : eventos

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">TVs de la sala</h1>
          <p className="text-xs text-text-tertiary mt-0.5">Cada TV reporta cada 10 s. Esta pantalla se actualiza sola.</p>
        </div>
        {error && <span className="text-xs text-red-600">No se pudo leer: {error}</span>}
      </div>

      {sedes.map((s) => (
        <div key={s.slug} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2"><Tarjeta titulo={`${s.nombre} · Fila`} fila={porPantalla.get(s.slug)} eventos={eventosDe(s.slug)}
              activa={filtro === s.slug} onClick={() => setFiltro(filtro === s.slug ? null : s.slug)} /></div>
          </div>
          {s.lineas.map((l) => (
            <div key={l.letra} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: l.capacidad }, (_, i) => {
                const id = `${s.slug}/${l.letra}/${i + 1}`
                return (
                  <Tarjeta key={id} titulo={`${l.letra}${i + 1}`} fila={porPantalla.get(id)} eventos={eventosDe(id)}
                    activa={filtro === id} onClick={() => setFiltro(filtro === id ? null : id)} />
                )
              })}
            </div>
          ))}
        </div>
      ))}

      {otras.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {otras.map((f) => (
            <Tarjeta key={f.pantalla} titulo={f.pantalla} fila={f} eventos={eventosDe(f.pantalla)}
              activa={filtro === f.pantalla} onClick={() => setFiltro(filtro === f.pantalla ? null : f.pantalla)} />
          ))}
        </div>
      )}

      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Registro {filtro ? `· ${filtro}` : '· todas las TVs'}</h2>
          {filtro && <button type="button" onClick={() => setFiltro(null)} className="text-xs text-brand">Ver todas</button>}
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-border-default">
          {lista.length === 0 && <div className="text-xs text-text-tertiary py-2">Sin eventos todavía.</div>}
          {lista.map((e) => (
            <div key={e.id} className="flex items-start gap-3 py-1.5 text-xs">
              <span className="font-mono text-text-tertiary shrink-0">{hora(e.created_at)}</span>
              <span className="font-mono text-text-secondary shrink-0 w-24 truncate">{e.pantalla}</span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${TIPOS[e.tipo]?.clase || 'bg-surface-secondary text-text-secondary'}`}>
                {TIPOS[e.tipo]?.texto || e.tipo}
              </span>
              <span className="text-text-primary break-all">{e.mensaje}</span>
            </div>
          ))}
        </div>
      </div>

      <Pruebas />
    </div>
  )
}
