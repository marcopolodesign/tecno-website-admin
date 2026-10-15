// Sirve dist/ con un sonda ES5 inyectada que reporta errores y el estado del DOM a /report.
import http from 'node:http'
import { readFileSync, existsSync, appendFileSync } from 'node:fs'
import { join, extname } from 'node:path'
const DIST = process.argv[2], LOG = process.argv[3], PORT = 4747
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.mp4': 'video/mp4' }
const SONDA = `<script>(function(){function r(t,d){try{var x=new XMLHttpRequest();x.open('POST','/report',true);x.send(t+' '+d)}catch(e){}}
window.onerror=function(m,s,l,c,e){r('ERROR',m+' @'+s+':'+l+':'+c+' '+(e&&e.stack||''))};
r('UA',navigator.userAgent);
var n=0;var iv=setInterval(function(){n++;var root=document.getElementById('root');var h=root?root.innerHTML:'';
r('DOM'+n,'len='+h.length+' text='+(root?(root.innerText||'').replace(/\\s+/g,' ').slice(0,300):'')+' bodyBg='+getComputedStyle(document.body).backgroundColor+' rootRect='+(root?JSON.stringify(root.getBoundingClientRect()):''));
if(n>=4)clearInterval(iv)},4000)})();</script>`
http.createServer((req, res) => {
  if (req.url === '/report') { let b=''; req.on('data', c => b += c); req.on('end', () => { appendFileSync(LOG, new Date().toISOString().slice(11,19)+' '+b+'\n'); res.end('ok') }); return }
  let p = decodeURIComponent(req.url.split('?')[0])
  let f = join(DIST, p)
  if (!existsSync(f) || p.endsWith('/') || !extname(p)) f = join(DIST, 'index.html')
  let body = readFileSync(f)
  if (f.endsWith('index.html')) {
    body = body.toString().replace('<head>', '<head>' + SONDA)
    // Modo TV vieja: sin ES modules, como Chrome 47 — sólo corre el bundle nomodule.
    if (process.env.LEGACY) body = body.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>/g, '').replace(/ nomodule/g, '')
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' })
  res.end(body)
}).listen(PORT, () => console.log('listo', PORT))
