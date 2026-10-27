// Lo que comparten TODAS las pantallas de TV (estación, sede, línea) — 2026-09-30:
//   · LienzoTv: el lienzo de diseño (1920 de ancho) escalado por ANCHO, con alto fluido. La TV
//     de Mateo (navegador Samsung con la barra visible) no es 16:9: escalar "para que entre"
//     dejaba bandas negras a los costados. Ahora siempre llena el 100% del ancho y del alto; el
//     área del medio absorbe la diferencia.
//   · ControlesTv: botón de pantalla completa abajo al centro (es el único borde libre en las tres
//     pantallas: arriba a la derecha está el reloj/cuenta regresiva) (sutil, aparece al mover el mouse/control y se
//     oculta a los ~4 s), entrar a pantalla completa con el primer click / Enter (los navegadores
//     exigen un gesto), cursor oculto tras inactividad y el debug ?reloj=1 con el corrimiento
//     del reloj del servidor.
import { createContext, useContext, useEffect, useState } from 'react'
import { estadoReloj, suscribirReloj } from '../../lib/serverClock'
import { ANCHO_DISENO, medidasLienzo } from '../../lib/lienzo'
import { BORDE, COLOR, FUENTES_TV, RADIO } from './tokens'

const OCULTAR_MS = 4000

const LienzoContext = createContext({ ancho: ANCHO_DISENO, alto: 1080 })
export const useLienzo = () => useContext(LienzoContext)

function medir() {
  if (typeof window === 'undefined') return { escala: 1, ancho: ANCHO_DISENO, alto: 1080 }
  return medidasLienzo(window.innerWidth, window.innerHeight)
}

export function LienzoTv({ children, fondo = COLOR.fondo }) {
  const [m, setM] = useState(medir)
  useEffect(() => {
    const onResize = () => setM(medir())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // Diagnóstico del video en Samsung (2026-10-26): ?sinescala=1 / ?sinfixed=1 / ?sinanim=1 / ?sinfondo=1
  // apagan una capa por vez para ver cuál le impide a la TV dibujar el <video> (que sí se reproduce).
  const dbg = (k) => typeof window !== 'undefined' && new RegExp('[?&]' + k + '=1').test(window.location.search)
  return (
    // 2026-10-27: con el lienzo en `position: fixed` + `overflow: hidden`, las Samsung (Tizen 5 probado
    // en la tele de Mateo) reproducían el <video> pero no lo dibujaban — sólo se veía el póster. Con
    // `absolute` y sin recorte en el contenedor anda. El recorte va en html/body.
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: fondo, overflow: 'visible' }}>
      <style>{FUENTES_TV + 'html,body{margin:0;width:100%;height:100%;overflow:hidden}'}</style>
      {dbg('sinanim') && <style>{'*,*:before,*:after{animation:none!important;transition:none!important}'}</style>}
      {dbg('sinfondo') && <style>{'[data-fondo-manchas]{display:none!important}'}</style>}
      <div style={{ width: m.ancho, height: m.alto, transform: dbg('sinescala') ? 'none' : `scale(${m.escala})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
        <LienzoContext.Provider value={{ ancho: m.ancho, alto: m.alto }}>{children}</LienzoContext.Provider>
      </div>
      <ControlesTv />
    </div>
  )
}

const pantallaCompletaActiva = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement)

function entrarPantallaCompleta() {
  const el = document.documentElement
  try {
    const p = (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)
    if (p && p.catch) p.catch(() => {})
  } catch {
    /* el navegador no lo permite: nada que hacer */
  }
}

export function ControlesTv() {
  const [visible, setVisible] = useState(true)
  const [completa, setCompleta] = useState(false)
  const [reloj, setReloj] = useState(estadoReloj)
  const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('reloj') === '1'

  useEffect(() => {
    let t = null
    let intento = false
    const estilo = document.createElement('style')
    document.head.appendChild(estilo)
    const mostrar = () => {
      setVisible(true)
      estilo.textContent = ''
      clearTimeout(t)
      t = setTimeout(() => {
        setVisible(false)
        estilo.textContent = 'html, body, body * { cursor: none !important; }'
      }, OCULTAR_MS)
    }
    const onFs = () => setCompleta(pantallaCompletaActiva())
    // El primer click o Enter (el OK del control remoto) entra a pantalla completa, una sola vez:
    // si después se sale con Esc, el botón sigue ahí.
    const onGesto = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter') return
      if (!intento && !pantallaCompletaActiva()) {
        intento = true
        entrarPantallaCompleta()
      }
    }
    mostrar()
    onFs()
    const ev = ['mousemove', 'mousedown', 'touchstart', 'keydown']
    ev.forEach((n) => window.addEventListener(n, mostrar, { passive: true }))
    window.addEventListener('click', onGesto)
    window.addEventListener('keydown', onGesto)
    document.addEventListener('fullscreenchange', onFs)
    document.addEventListener('webkitfullscreenchange', onFs)
    const off = suscribirReloj(setReloj)
    return () => {
      clearTimeout(t)
      estilo.remove()
      ev.forEach((n) => window.removeEventListener(n, mostrar))
      window.removeEventListener('click', onGesto)
      window.removeEventListener('keydown', onGesto)
      document.removeEventListener('fullscreenchange', onFs)
      document.removeEventListener('webkitfullscreenchange', onFs)
      off()
    }
  }, [])

  return (
    <>
      {!completa && (
        <button
          type="button"
          aria-label="Pantalla completa"
          title="Pantalla completa"
          data-testid="btn-pantalla-completa"
          onClick={(e) => {
            e.stopPropagation()
            entrarPantallaCompleta()
          }}
          style={{
            position: 'fixed', bottom: 0, left: '50%', marginLeft: -22, zIndex: 1000, width: 44, height: 44, borderRadius: RADIO.mini,
            border: BORDE, background: COLOR.vidrio, color: COLOR.texto,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
            opacity: visible ? 0.85 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity 0.35s',
            backdropFilter: 'blur(6px)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      )}
      {debug && (
        <div style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 1000, padding: '6px 10px', borderRadius: RADIO.mini, background: COLOR.vidrio, color: '#7dd3fc', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 14 }}>
          {reloj.sincronizado
            ? `reloj: ${reloj.offsetMs >= 0 ? '+' : ''}${Math.round(reloj.offsetMs)} ms vs servidor (rtt ${reloj.rttMs} ms)`
            : 'reloj: sin sincronizar'}
        </div>
      )}
    </>
  )
}
