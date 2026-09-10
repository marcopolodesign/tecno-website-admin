// Banco de pruebas del EMOM por minuto — NO entra en la app.
//
// Existe por una razón concreta: en este entorno ni `vite dev` ni `vite preview` levantan (el
// proceso imprime la URL y se muere), y el build servido estático pide login, que no es algo que
// se pueda automatizar. Sin esto, la única forma de mirar la pantalla era pushear a staging, y
// staging es justo lo que no se puede tocar mientras hay una demo en vivo.
//
// Monta el SelectorFormato real y reproduce el bloque de composición del minuto tal como lo
// arma Routines.jsx, con filas de ejemplo. Lo que se ve acá es el componente de verdad y los
// helpers de verdad de formatos.js — no una maqueta.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import SelectorFormato from './components/SelectorFormato'
import { gruposDelMinuto, resumenDelMinuto, sobranteDelMinuto, PRESETS } from './lib/formatos'
import './index.css'

// El ejemplo textual de Mateo: "10 push ups + 30s plancha en el mismo minuto", más dos
// ejercicios extra para ver la rotación cuando la estación tiene más de los que entran.
const FILAS = [
  { id: 1, exercises: { name: 'Push ups' }, reps: 10 },
  { id: 2, exercises: { name: 'Plancha' }, segundosPorEjercicio: 30 },
  { id: 3, exercises: { name: 'Remo con mancuerna' }, reps: 12 },
  { id: 4, exercises: { name: 'Hollow hold' }, segundosPorEjercicio: 40 },
]

function Composicion({ estacionFormato, filas }) {
  const porMinuto = Math.max(1, estacionFormato.ejerciciosPorMinuto || 1)
  const grupos = gruposDelMinuto(filas, porMinuto)
  return (
    <div className="mt-2 text-xs text-text-tertiary space-y-1">
      <p>
        EMOM — <strong className="text-text-secondary">{porMinuto} por minuto</strong>
        {grupos.length > 1 && ` · rota en ${grupos.length} minutos distintos`}
      </p>
      {grupos.map((grupo, i) => {
        const sobra = sobranteDelMinuto(grupo)
        return (
          <p key={i}>
            Minuto {i + 1}: {resumenDelMinuto(grupo, (f) => f.exercises?.name)}
            {' · '}
            <span className={sobra < 0 ? 'text-error font-medium' : ''}>
              {sobra < 0 ? `se pasa ${Math.abs(sobra)}s` : `quedan ${sobra}s`}
            </span>
          </p>
        )
      })}
    </div>
  )
}

function Banco() {
  const [estacionFormato, setEstacionFormato] = useState({ formato: 'EMOM', ...PRESETS.EMOM })
  const [cuantas, setCuantas] = useState(2)
  const filas = FILAS.slice(0, cuantas)

  return (
    <div style={{ maxWidth: 720, margin: '32px auto', padding: '0 20px', fontFamily: 'system-ui' }}>
      <h1 className="text-xl font-semibold text-text-primary mb-1">EMOM por minuto</h1>
      <p className="text-sm text-text-secondary mb-6">
        Banco de pruebas: el SelectorFormato real y la composición del minuto tal como se ve en el
        armador.
      </p>

      <div className="card border-0 shadow-none mb-4">
        <label className="form-label">Modalidad de la estación</label>
        <SelectorFormato valor={estacionFormato} onChange={setEstacionFormato} turnoSeg={480} />
        {estacionFormato.formato === 'EMOM' && (
          <Composicion estacionFormato={estacionFormato} filas={filas} />
        )}
      </div>

      <div className="text-xs text-text-tertiary">
        Ejercicios cargados en la estación:{' '}
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => setCuantas(n)}
            className={`ml-1 px-2 py-0.5 rounded ${
              cuantas === n ? 'bg-brand/10 text-brand font-semibold' : 'bg-bg-surface'
            }`}
          >
            {n}
          </button>
        ))}
        <span className="ml-2">({filas.map((f) => f.exercises.name).join(', ')})</span>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<Banco />)
