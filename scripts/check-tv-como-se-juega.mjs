// Control (2026-10-07): "Cómo se juega" va sólo en la explicación, nunca en la estación corriendo.
// Correr: node scripts/check-tv-como-se-juega.mjs
import fs from 'fs'
const src = fs.readFileSync(new URL('../src/components/QueueTvEstacion.jsx', import.meta.url), 'utf8')
const ini = src.indexOf('function VistaEstacion(')
const fin = src.indexOf('\nfunction ', ini + 1)
const estacion = src.slice(ini, fin === -1 ? undefined : fin)
const explicacion = src.slice(src.indexOf('function VistaExplicacion('), ini)
let ok = true
if (ini === -1 || /TarjetaComoSeJuega|C[óo]mo se juega/i.test(estacion)) { console.error('✗ la estación muestra "Cómo se juega"'); ok = false }
if (!/TarjetaComoSeJuega/.test(explicacion)) { console.error('✗ la explicación no muestra "Cómo se juega"'); ok = false }
console.log(ok ? '✓ "Cómo se juega" sólo en la explicación' : '')
process.exit(ok ? 0 : 1)
