# Probar las pantallas de TV como en la sala (Samsung Tizen 3.0 · Chrome 47)

Un Chrome 47 de verdad no levanta red en macOS moderno, así que se prueba con un Chromium actual
"rebajado": sin ES modules (corre sólo el bundle `nomodule`), sin `Proxy`/`Reflect` ni las APIs que
llegaron después de Chrome 47, y con `?sin-grid=1&sin-gap=1&sin-vars=1` para forzar los respaldos
de grid, `gap` y variables CSS.

```bash
npx vite build --outDir /tmp/tv47
LEGACY=1 node scripts/tv-chrome47/server.mjs /tmp/tv47 /tmp/tv47.log &      # http://localhost:4747
npm i --no-save playwright-core
node scripts/tv-chrome47/probe.mjs http://localhost:4747 /tmp/tv47-shot singrid
```

Cada pantalla tiene que mostrar texto y salir "sin errores"; las capturas quedan en `/tmp/tv47-shot-*.png`.

En vivo contra tv.somostecnofit.com (el host de TV usa /palermo, /palermo/A, /palermo/A/1):

```bash
LIVE=1 URLS=/palermo,/palermo/A,/palermo/A/1 node scripts/tv-chrome47/probe.mjs https://tv.somostecnofit.com /tmp/tv47-live singrid
```
