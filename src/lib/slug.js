// Slug de sede para las URLs lindas de TV (tv.somostecnofit.com/palermo/A/1). Tiene que
// coincidir EXACTO con `sede_slug()` en SQL (tecnofit-supabase/supabase/migrations/
// 20260923160000_tv_links_por_slug.sql), porque `tv_resolver()` compara este mismo slug del
// lado del servidor: minúsculas, sin acentos, todo lo que no sea a-z0-9 se vuelve un guión,
// sin guiones al principio ni al final.
const ACENTOS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' }

export function sedeSlug(name) {
  if (!name) return ''
  const sinAcentos = name
    .toLowerCase()
    .split('')
    .map((c) => ACENTOS[c] ?? c)
    .join('')
  return sinAcentos.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// 1 → A, 2 → B, ... mismo criterio que boxLabel() en queueService.js.
export function lineaLetra(lineNumber) {
  return String.fromCharCode(64 + (lineNumber || 1))
}

const TV_HOST = 'https://tv.somostecnofit.com'

export function tvUrlSede(locationName) {
  return `${TV_HOST}/${sedeSlug(locationName)}`
}

export function tvUrlLinea(locationName, lineNumber) {
  return `${tvUrlSede(locationName)}/${lineaLetra(lineNumber)}`
}

export function tvUrlEstacion(locationName, lineNumber, posicion) {
  return `${tvUrlLinea(locationName, lineNumber)}/${posicion}`
}
