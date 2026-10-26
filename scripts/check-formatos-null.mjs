// La TV de Palermo A1 se rompió en prod (26/10) con "Cannot read property 'rondas' of null":
// la estación no tenía prescripción por tiempo y duracionSeg(null) explotaba. Esto falla el build
// si algún helper de formatos vuelve a no aguantar null.
import { duracionSeg, comoTexto, duracionEstacionSeg } from '../src/lib/formatos.js'
const casos = [
  () => duracionSeg(null), () => duracionSeg(undefined), () => comoTexto('Tabata', null),
  () => comoTexto(null, null), () => duracionEstacionSeg(null)
]
let mal = 0
for (const c of casos) { try { c() } catch (e) { mal++; console.error('✗', c.toString(), e.message) } }
if (mal) { console.error(`✗ ${mal} helper(s) de formatos no aguantan null`); process.exit(1) }
console.log('✓ helpers de formatos aguantan null')
