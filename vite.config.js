import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import legacy from '@vitejs/plugin-legacy'
import postcssPresetEnv from 'postcss-preset-env'
import { execSync } from 'node:child_process'

// Las TVs de las sedes (Samsung Tizen) traen un Chromium viejo — 69 en las de 2020. Con el
// target por defecto de Vite 7 (Chrome 107) el bundle tira SyntaxError y la pantalla queda en
// blanco. Bajamos el JS a Chrome 64 con polyfills, y el CSS de Tailwind 4 se reescribe (@layer,
// oklch, inset) porque esos Chromium lo descartan. Control: scripts/check-tv-legacy.mjs.
const TV_TARGETS = ['chrome >= 64', 'safari >= 12']

// Tailwind 4 mueve con la propiedad `translate` (Chrome 104+). En una TV vieja el -translate-y-1/2
// de centrar no hace nada, así que le sumamos el `transform` equivalente si la regla no tiene uno.
const translateFallback = {
  postcssPlugin: 'tv-translate-fallback',
  Declaration: {
    translate(decl) {
      const hasTransform = decl.parent.some((d) => d.type === 'decl' && d.prop === 'transform')
      if (hasTransform) return
      const [x, y = '0'] = decl.value.replace(/\)var\(/g, ') var(').split(/\s+/)
      decl.cloneBefore({ prop: 'transform', value: `translate(${x}, ${y})` })
    },
  },
}

// `gap` en flex no existe en Chrome 63: lo copiamos a una variable que lee src/lib/flexGapShim.js.
// Las variables se heredan, así que la regla `*` de abajo las vuelve a cero en cada elemento.
const SHIM_GAP = { gap: '--shim-gap', 'row-gap': '--shim-row-gap', 'column-gap': '--shim-col-gap' }
const gapFallback = {
  postcssPlugin: 'tv-gap-fallback',
  Declaration(decl) {
    const shim = SHIM_GAP[decl.prop]
    if (!shim || decl.parent.some((d) => d.type === 'decl' && d.prop === shim)) return
    decl.cloneAfter({ prop: shim })
    decl.cloneBefore({ prop: `grid-${decl.prop}` }) // en grid, Chrome 63 sí entiende grid-gap
  },
}

// Tailwind 4 declara sus valores por defecto con @property (Chrome 85+). Sin eso, cosas como
// var(--tw-border-style) quedan sin valor y el borde, la sombra o el translate se pierden. Los
// copiamos a una regla `*` común, que un Chromium viejo sí entiende.
const propertyFallback = {
  postcssPlugin: 'tv-property-fallback',
  OnceExit(root, { Rule }) {
    const decls = []
    root.walkAtRules('property', (at) => {
      let initial = null
      let inherits = 'false'
      at.walkDecls((d) => {
        if (d.prop === 'initial-value') initial = d.value
        if (d.prop === 'inherits') inherits = d.value
      })
      if (initial !== null && inherits === 'false') decls.push({ prop: at.params.trim(), value: initial })
    })
    Object.values(SHIM_GAP).forEach((prop) => decls.push({ prop, value: 'initial' }))
    const rule = new Rule({ selector: '*,::before,::after,::backdrop' })
    decls.forEach((d) => rule.append(d))
    root.prepend(rule)
  },
}

// Lo mismo con los estilos inline de React: `inset: 0` (Chrome 87+) no existe para la TV y el
// contenedor de pantalla completa queda de 0×0. Lo escribimos con top/right/bottom/left.
const insetInline = {
  name: 'tv-inset-inline',
  enforce: 'pre',
  transform(code, id) {
    if (!/\/src\/.*\.(jsx?|tsx?)$/.test(id) || !code.includes('inset')) return null
    return code.replace(/\binset:\s*0(?=\s*[,}])/g, 'top: 0, right: 0, bottom: 0, left: 0')
  },
}

// La versión del bundle que el aviso de errores de la TV (script inline de index.html) manda a Sentry.
function versionDelBuild() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'local' }
}
// Además lo sube a justo después del <meta charset>: plugin-legacy agrega scripts en el <head> y el
// aviso tiene que correr antes que cualquier bundle para atrapar lo que rompa al cargar.
const tvBuildVersion = {
  name: 'tv-build-version',
  enforce: 'post',
  transformIndexHtml: (html) => html.replace(/__TV_BUILD__/g, versionDelBuild()),
  generateBundle(_, bundle) {
    const archivo = bundle['index.html']
    if (!archivo || typeof archivo.source !== 'string') return
    const aviso = /\s*<script id="tv-reporte">[\s\S]*?<\/script>/.exec(archivo.source)
    if (!aviso) return
    archivo.source = archivo.source.replace(aviso[0], '').replace(/<meta charset="UTF-8" \/>/, (m) => m + aviso[0])
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tvBuildVersion,
    insetInline,
    tailwindcss(),
    react(),
    // El sistema viejo de las TVs (tecno-gym-server, /linea1/box1) era jQuery + ES5 y andaba en
    // cualquier tele. Para las que no tienen ES modules (Tizen 3–4, Chromium 47–56) va un bundle
    // aparte con nomodule; las demás reciben el moderno bajado a Chrome 64.
    legacy({
      targets: ['chrome >= 47', 'safari >= 10'],
      modernTargets: TV_TARGETS,
      modernPolyfills: true,
    }),
  ],
  css: {
    postcss: {
      plugins: [
        // El CSS es uno solo para los dos bundles, así que apunta a la tele más vieja (Chromium 47,
        // sin variables CSS: los valores de :root se resuelven en el build y quedan de respaldo).
        postcssPresetEnv({
          browsers: ['chrome >= 47', 'safari >= 10'],
          stage: 2,
          features: { 'cascade-layers': true, 'custom-properties': { preserve: true } },
        }),
        translateFallback,
        gapFallback,
        propertyFallback,
      ],
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    hmr: {
      overlay: true,
    },
  },
})
