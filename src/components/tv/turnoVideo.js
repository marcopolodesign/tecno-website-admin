// Modo "un video a la vez" (TVs viejas, 2026-10-23): las Samsung Tizen 3.0 de la sala decodifican
// UN SOLO <video> de HTML5 por vez (un único plano de hardware). Con la estación de 4 ejercicios
// mostrando 4 tarjetas de VideoCruzado (cada una con su propio <video> autoplay), ninguna dibuja —
// las 4 quedan en negro.
//
// Acá vive el dueño único del turno para TODA la pantalla: un store de módulo (no un timer por
// tarjeta) donde cada VideoCruzado se anota al montarse y se desanota al desmontarse, y un solo
// setInterval compartido va rotando cuál de las anotadas tiene el video real. Las demás muestran
// su póster quieto. Con una sola tarjeta anotada (p. ej. Tabata/EMOM de un solo ejercicio) el turno
// no tiene con quién alternar y le queda fijo.
import { useEffect, useState } from 'react'

const TURNO_MS = 6000

let claves = [] // orden de registro — estable mientras no cambian las tarjetas en pantalla
let turno = 0
const listeners = new Set()
let intervalId = null

function avisar() {
  listeners.forEach((f) => f())
}

function asegurarIntervalo() {
  if (intervalId || claves.length === 0) return
  intervalId = setInterval(() => {
    if (claves.length === 0) return
    turno = (turno + 1) % claves.length
    avisar()
  }, TURNO_MS)
}

function detenerSiVacio() {
  if (claves.length === 0 && intervalId) {
    clearInterval(intervalId)
    intervalId = null
    turno = 0
  }
}

function registrar(clave) {
  if (claves.indexOf(clave) === -1) claves.push(clave)
  asegurarIntervalo()
  avisar()
}

function desregistrar(clave) {
  const i = claves.indexOf(clave)
  if (i === -1) return
  claves.splice(i, 1)
  if (turno >= claves.length) turno = 0
  detenerSiVacio()
  avisar()
}

// `clave` identifica la tarjeta (estable mientras el ejercicio que muestra no cambia). Devuelve
// true sólo para la tarjeta a la que le toca el video real en este momento.
export function useTurnoVideo(clave) {
  const [, forzar] = useState(0)
  useEffect(() => {
    if (!clave) return undefined
    registrar(clave)
    const f = () => forzar((n) => n + 1)
    listeners.add(f)
    return () => {
      listeners.delete(f)
      desregistrar(clave)
    }
  }, [clave])
  if (!clave) return false
  const i = claves.indexOf(clave)
  return i !== -1 && i === turno
}

// Gancho para verificar a mano / desde un control: cuántas tarjetas están anotadas ahora mismo.
export function __turnoVideoDebug() {
  return { claves: claves.slice(), turno }
}
