// Lo que este socio no puede hacer, en un formato que el motor pueda leer.
//
// El catálogo marca 189 ejercicios con contraindicaciones. Del lado del socio sólo había un
// booleano y una nota de texto libre, y ningún motor puede respetar "cuidado con la rodilla
// izquierda" escrito en un campo de notas — así que los ejercicios llevaban una etiqueta de
// seguridad que nada leía.
//
// La nota médica sigue estando y sigue siendo lo que un coach realmente escribe. Esto es la
// parte que además se puede aplicar sola: el motor de sustitución no ofrece nunca un ejercicio
// marcado con algo que el socio tiene acá.
//
// Lista cerrada, la misma con la que están etiquetados los ejercicios. Si fuera texto libre no
// habría con qué cruzarla, que es exactamente el problema que vino a resolver.

const CONTRAINDICACIONES = ['Rodilla', 'Hombro', 'Lumbar', 'Cervical', 'Cardio', 'Embarazo']

export default function SelectorContraindicaciones({ valor, onChange }) {
  const puestas = valor || []

  const alternar = (c) =>
    onChange(puestas.includes(c) ? puestas.filter((v) => v !== c) : [...puestas, c])

  return (
    <div>
      <label className="form-label">Contraindicaciones</label>
      <div className="flex flex-wrap gap-1.5">
        {CONTRAINDICACIONES.map((c) => {
          const activa = puestas.includes(c)
          return (
            <button
              key={c}
              type="button"
              onClick={() => alternar(c)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                activa
                  ? 'bg-brand/10 border-brand text-brand font-semibold'
                  : 'bg-white border-border-default text-text-secondary hover:border-brand/50'
              }`}
            >
              {c}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-text-tertiary mt-2 leading-relaxed">
        {puestas.length === 0
          ? 'Sin contraindicaciones cargadas: el motor de rutinas le puede ofrecer cualquier ejercicio.'
          : 'El motor no le va a ofrecer ningún ejercicio marcado con esto, ni al generar el mes ni al sugerir un cambio.'}
      </p>
    </div>
  )
}
