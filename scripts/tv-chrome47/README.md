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

`PORT=4791` cambia el puerto del server si el 4747 está ocupado.

## Aviso de errores (cartel en pantalla + Sentry)

`index.html` trae un script inline ES5 (`<script id="tv-reporte">`, antes de los bundles) y `TvHostApp`
un `TvErrorBoundary`. Si la TV falla, pinta el error con sede, pantalla, archivo y línea (a pantalla
completa si no se llegó a dibujar nada; si no, una franja abajo) y lo manda a Sentry por XHR, sin el
SDK, con los tags `superficie=tv`, `sede`, `pantalla`, `ua`, `version`, `bundle`, `origen` y la IP
(`user.ip_address = {{auto}}`). Se fuerza con `?tv-error-prueba=onerror | promesa | render`.

```bash
PORT=4791 node scripts/tv-chrome47/server.mjs $PWD/dist /tmp/tv47.log &
SIN_ENVIO=1 node scripts/tv-chrome47/aviso.mjs http://localhost:4791 /tmp/tv-aviso       # sin ensuciar Sentry
node scripts/tv-chrome47/aviso.mjs https://tv.somostecnofit.com /tmp/tv-aviso-live /palermo/A/1
```
