import { Link } from 'react-router-dom'
import {
  CreditCardIcon,
  UsersIcon,
  AcademicCapIcon,
  CubeIcon,
  QrCodeIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { useSede } from '../contexts/SedeContext'

// Pantalla intermedia de "Sede → Configuración" (estructura pedida por Mateo, 2026-09-10).
//
// Por qué existe: Membresías, Vendedores, Coaches y Productos son catálogos — se cargan una
// vez y se tocan de vez en cuando. Tenerlos sueltos en el menú les daba el mismo peso visual
// que Caja, que se abre y se cierra todos los días. Agrupados acá el menú de Sede queda en
// cuatro items y cada uno es una decisión distinta, en vez de una lista de ocho.
//
// El Check-in vive acá y no en el menú porque no es una pantalla que se navegue: es el
// kiosko que se deja puesto en la tablet de la puerta. Se entra una vez por día, no se
// consulta.
const SECCIONES = [
  {
    titulo: 'Qué se vende',
    items: [
      {
        name: 'Membresías',
        href: '/membership-plans',
        icon: CreditCardIcon,
        detalle: 'Los planes y sus precios. Es lo que se ofrece al dar de alta un socio y lo que aparece al cobrar por caja.',
      },
      {
        name: 'Productos',
        href: '/productos',
        icon: CubeIcon,
        detalle: 'Lo que se vende por mostrador: bebidas, merch, suplementos y servicios sueltos. Acá se cargan precios y stock.',
      },
    ],
  },
  {
    titulo: 'Quién trabaja',
    items: [
      {
        name: 'Vendedores',
        href: '/sellers',
        icon: UsersIcon,
        detalle: 'La gente de recepción: quién puede abrir caja, vender y dar de alta socios.',
      },
      {
        name: 'Coaches',
        href: '/coaches',
        icon: AcademicCapIcon,
        detalle: 'Los coaches de la sede. A quién queda asignado un socio se define por la hora de su clase, en Horas.',
      },
    ],
  },
  {
    titulo: 'La puerta',
    items: [
      {
        name: 'Check-in',
        href: '/check-in',
        icon: QrCodeIcon,
        detalle: 'El kiosko que se deja puesto en la tablet de la entrada. Se abre una vez y queda ahí.',
      },
    ],
  },
]

export default function Configuracion() {
  const { sede } = useSede()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Configuración</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          {sede?.name ? `${sede.name} — ` : ''}lo que se carga una vez y después se usa todos los días
        </p>
      </div>

      {SECCIONES.map((seccion) => (
        <div key={seccion.titulo}>
          <h2 className="text-sm font-semibold text-text-primary mb-3">{seccion.titulo}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {seccion.items.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="card border-0 shadow-none flex items-start gap-3 transition-colors hover:brightness-[0.97]"
              >
                <div className="p-2 rounded-lg shrink-0 bg-brand/10 text-brand">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{item.name}</p>
                  <p className="text-xs text-text-secondary mt-1">{item.detalle}</p>
                </div>
                <ChevronRightIcon className="h-5 w-5 text-text-tertiary shrink-0 mt-0.5" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
