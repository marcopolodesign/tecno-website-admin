// Lo que se ve DENTRO de un box en la TV de línea (QueueTv.jsx) — un box entre cinco, columna
// angosta. Separado de QueueTv.jsx para que la TV de estación (QueueTvEstacion.jsx, un solo
// box a pantalla completa) pueda compartir el reloj de formato y el cálculo de fase sin
// duplicar faseDelFormato a mano en dos lugares — sólo cambia el tamaño de letra, no la cuenta.
import { useEffect, useState } from 'react'
import { esPorTiempo, faseDelFormato, comoTexto, filasDelMinuto, prescripcionTexto } from '../../lib/formatos'
import { explicacionDeFormato } from '../../lib/modalidadTexto'
import { formatMMSS } from '../../lib/tvClock'
import { exerciseMedia } from '../../lib/exerciseMedia'
import VideoEjercicio from '../VideoEjercicio'

// El reloj de formato (AMRAP/EMOM/Tabata/...), a partir de CUÁNDO ARRANCÓ LA ESTACIÓN — no de
// cuándo entró al box. Con explicación, esos dos instantes ya no son el mismo: entró, miró un
// minuto de explicación, y recién ahí arranca el reloj que cuenta rondas.
export function useFaseEstacion(estacionInicioIso, formato) {
  const [fase, setFase] = useState(null)

  useEffect(() => {
    if (!estacionInicioIso || !esPorTiempo(formato?.formato)) {
      setFase(null)
      return
    }
    const inicioMs = new Date(estacionInicioIso).getTime()
    let rafId
    const loop = () => {
      const transcurrido = Math.floor((Date.now() - inicioMs) / 1000)
      const f = faseDelFormato(Math.max(0, transcurrido), formato)
      setFase((prev) =>
        prev && f && prev.fase === f.fase && prev.ronda === f.ronda && prev.restanteSeg === f.restanteSeg
          ? prev
          : f
      )
      rafId = window.requestAnimationFrame(loop)
    }
    rafId = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(rafId)
  }, [estacionInicioIso, formato?.formato, formato?.rondas, formato?.trabajoSeg, formato?.descansoSeg])

  return fase
}

export function RelojFormato({ fase, formato }) {
  if (!fase) return null
  const trabajando = fase.fase === 'trabajo'
  const color = fase.terminado ? 'rgba(255,255,255,0.45)' : trabajando ? '#4ADE80' : '#FBBF24'
  return (
    <div style={{ ...panelStyles.formato, borderColor: color }}>
      <span style={{ ...panelStyles.formatoFase, color }}>
        {fase.terminado ? 'Terminado' : trabajando ? 'TRABAJO' : 'DESCANSO'}
      </span>
      <span style={{ ...panelStyles.formatoSeg, color }}>{fase.restanteSeg}</span>
      <span style={panelStyles.formatoRonda}>
        {formato.formato === 'AMRAP' || formato.formato === 'A completar'
          ? 'las vueltas que entren'
          : `ronda ${fase.ronda} de ${formato.rondas}`}
      </span>
    </div>
  )
}

export function ExercisePanel({ exercise, exercises, estacionInicioIso }) {
  if (!exercise) {
    return (
      <div style={panelStyles.empty}>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Entrenando</span>
      </div>
    )
  }

  const ex = exercise
  const formato = {
    formato: ex.formato,
    rondas: ex.rondas,
    trabajoSeg: ex.trabajo_seg,
    descansoSeg: ex.descanso_seg,
  }
  const fase = useFaseEstacion(estacionInicioIso, formato)

  // Qué ejercicio(s) le tocan a ESTE minuto — ver el comentario largo original en QueueTv.jsx
  // (git blame): `ejercicio` es siempre la primera fila; `ejercicios` (plural) trae la
  // estación completa para poder agrupar un EMOM de "varios por minuto".
  const estacion = exercises?.length ? exercises : [ex]
  const porMinuto = ex.formato === 'EMOM' ? Math.max(1, ex.ejercicios_por_minuto || 1) : 1
  const delMinuto =
    ex.formato === 'EMOM' && fase && !fase.terminado
      ? filasDelMinuto(estacion, porMinuto, fase.ronda)
      : [ex]

  if (delMinuto.length > 1) {
    return (
      <div style={panelStyles.wrapper}>
        <RelojFormato fase={fase} formato={formato} />
        <div style={panelStyles.minuto}>
          {delMinuto.map((f) => (
            <div key={f.exercise_order ?? f.name} style={panelStyles.minutoFila}>
              <span style={panelStyles.minutoFilaPrescripcion}>
                {f.sets_reps || prescripcionTexto({ segundos: f.segundos_por_ejercicio })}
              </span>
              <span style={panelStyles.minutoFilaNombre}>{f.name}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const actual = delMinuto[0] || ex
  const media = exerciseMedia(actual, 'tv')

  return (
    <div style={panelStyles.wrapper}>
      <div style={panelStyles.media}>
        {media.kind === 'hosted' ? (
          <VideoEjercicio
            src={media.src}
            poster={media.poster}
            recorte={media.recorte}
            style={{ ...panelStyles.mediaEl, ...media.style }}
          />
        ) : media.kind === 'youtube' ? (
          <iframe
            src={`https://www.youtube.com/embed/${media.embedId}?autoplay=1&mute=1&loop=1&controls=0&playlist=${media.embedId}`}
            style={panelStyles.mediaEl}
            allow="autoplay; encrypted-media"
            title={actual?.name}
          />
        ) : media.kind === 'image' ? (
          <img src={media.src} alt={actual?.name} style={panelStyles.mediaEl} />
        ) : (
          <div style={{ ...panelStyles.mediaEl, background: 'rgba(255,255,255,0.06)' }} />
        )}
      </div>
      <span style={panelStyles.exerciseName}>{actual?.name ?? 'Ejercicio'}</span>
      {fase ? (
        <>
          <RelojFormato fase={fase} formato={formato} />
          <span style={panelStyles.exerciseMeta}>
            {[comoTexto(ex.formato, formato), actual.sets_reps].filter(Boolean).join(' · ')}
          </span>
        </>
      ) : (
        <span style={panelStyles.exerciseMeta}>
          {[actual.sets_reps, actual.rest_time ? `descanso ${actual.rest_time}s` : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
    </div>
  )
}

// Lo que se ve en el box mientras dura el minuto de explicación: qué modalidad es, cómo se
// juega (en criollo, ver modalidadTexto.js), los ejercicios de la estación con su prescripción
// grande, y la cuenta regresiva a que arranque el reloj de verdad.
export function ExplicacionPanel({ exercises, restanteSeg }) {
  const primero = exercises?.[0]
  if (!primero) return null

  const { titulo, texto } = explicacionDeFormato(primero.formato, {
    rondas: primero.rondas,
    trabajoSeg: primero.trabajo_seg,
    descansoSeg: primero.descanso_seg,
    ejerciciosPorMinuto: primero.ejercicios_por_minuto,
  })

  return (
    <div style={panelStyles.wrapper}>
      <span style={panelStyles.explicacionLabel}>EXPLICACIÓN</span>
      <span style={panelStyles.explicacionTitulo}>{titulo}</span>
      <span style={panelStyles.explicacionTexto}>{texto}</span>
      <div style={panelStyles.minuto}>
        {exercises.map((f, i) => (
          <div key={f.exercise_order ?? i} style={panelStyles.minutoFila}>
            <span style={panelStyles.minutoFilaPrescripcion}>
              {f.sets_reps || prescripcionTexto({ segundos: f.segundos_por_ejercicio })}
            </span>
            <span style={panelStyles.minutoFilaNombre}>{f.name}</span>
          </div>
        ))}
      </div>
      <div style={panelStyles.explicacionCountdown}>
        <span style={panelStyles.explicacionCountdownLabel}>Empieza en</span>
        <span style={panelStyles.explicacionCountdownValor}>{formatMMSS(restanteSeg)}</span>
      </div>
    </div>
  )
}

export const panelStyles = {
  wrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' },
  empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 90 },
  media: {
    width: '100%',
    aspectRatio: '16 / 10',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#000',
  },
  mediaEl: { width: '100%', height: '100%', objectFit: 'cover', border: 0 },
  exerciseName: { color: 'white', fontSize: 15, fontWeight: 700, textAlign: 'center' },
  exerciseMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' },
  formato: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
    border: '2px solid', borderRadius: 14, padding: '6px 14px', minWidth: 110,
  },
  formatoFase: { fontSize: 11, fontWeight: 800, letterSpacing: 1.5 },
  formatoSeg: { fontSize: 40, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1 },
  formatoRonda: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  minuto: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' },
  minutoFila: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    padding: '10px 8px', borderRadius: 10,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  },
  minutoFilaPrescripcion: { color: '#F45F37', fontSize: 20, fontWeight: 800, fontFamily: 'monospace' },
  minutoFilaNombre: { color: 'white', fontSize: 14, fontWeight: 700, textAlign: 'center' },
  // Explicación — mismo lenguaje visual que el box en marcha, en tono ámbar para que se
  // distinga de un vistazo del naranja de "estación corriendo".
  explicacionLabel: { color: '#FBBF24', fontSize: 12, fontWeight: 800, letterSpacing: 2 },
  explicacionTitulo: { color: 'white', fontSize: 16, fontWeight: 700, textAlign: 'center' },
  explicacionTexto: { color: 'rgba(255,255,255,0.6)', fontSize: 11.5, textAlign: 'center', lineHeight: 1.35 },
  explicacionCountdown: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
    border: '2px solid #FBBF24', borderRadius: 14, padding: '6px 14px', minWidth: 110,
  },
  explicacionCountdownLabel: { fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: '#FBBF24' },
  explicacionCountdownValor: { fontSize: 32, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1, color: '#FBBF24' },
}
