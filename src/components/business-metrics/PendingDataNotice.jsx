import { InformationCircleIcon } from '@heroicons/react/24/outline'

// Se muestra en vez del chart cuando la métrica depende de un dato que hoy nadie carga
// todavía (clase de prueba agendada/asistida, coach de la prueba). No es "sin datos" —
// es "el dato no existe hasta que alguien lo empiece a cargar a mano". La distinción
// importa: evita que el dueño piense que el pipeline de leads está vacío cuando en
// realidad lo que falta es el paso manual de marcar la clase de prueba.
export default function PendingDataNotice({ children }) {
  return (
    <div className="rounded-lg bg-info/5 border border-info/20 p-4 flex items-start gap-2.5">
      <InformationCircleIcon className="h-4 w-4 text-info flex-shrink-0 mt-0.5" />
      <div className="text-xs text-text-secondary leading-relaxed">{children}</div>
    </div>
  )
}
