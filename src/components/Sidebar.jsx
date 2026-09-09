import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import SedeSwitcher from './SedeSwitcher'
import {
  HomeIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  UserCircleIcon,
  FunnelIcon,
  UsersIcon,
  AcademicCapIcon,
  MapPinIcon,
  CreditCardIcon,
  XMarkIcon,
  QrCodeIcon,
  ClockIcon,
  // Fitness icons
  ClipboardDocumentListIcon,
  RectangleGroupIcon,
  WrenchScrewdriverIcon,
  // Lista de espera icons
  QueueListIcon,
  Cog6ToothIcon,
  // Space switcher
  ChevronUpDownIcon,
  CheckIcon,
  BuildingStorefrontIcon,
  BoltIcon,
  ArrowRightOnRectangleIcon,
  UserGroupIcon,
  ChartBarSquareIcon,
} from '@heroicons/react/24/outline'

// Emails allowed to see fitness section (beta feature)
const FITNESS_ALLOWED_EMAILS = ['mateoaldao@gmail.com', 'lucas@tecnofit.test']

// La estructura de Gestión la definió Mateo (2026-09-09): primero el día de hoy, después
// las personas, después la sede, y al final lo que sólo toca un super admin. Los subtítulos
// no son decorativos — son la diferencia entre una lista de doce items y cuatro decisiones.

// Sin subtítulo a propósito: es la portada, no una categoría.
const hoyNav = [
  { name: 'Hoy', href: '/hoy', icon: HomeIcon, roles: ['super_admin', 'admin', 'front_desk'] },
]

// El recorrido de una persona, en orden: primero es un lead, después un prospecto que dejó
// sus datos, después un socio. El Funnel es esa misma historia mirada de arriba.
const usuariosNav = [
  { name: 'Leads', href: '/leads', icon: FunnelIcon, roles: ['super_admin', 'admin', 'front_desk'] },
  { name: 'Prospects', href: '/prospects', icon: EnvelopeIcon, roles: ['super_admin', 'admin', 'front_desk'] },
  { name: 'Socios', href: '/users', icon: UserCircleIcon, roles: ['super_admin', 'admin', 'front_desk', 'coach'] },
  // Funnel entra acá en cuanto exista la pantalla (se está construyendo en paralelo). Un item
  // de menú que lleva a una pantalla en blanco es peor que un item que todavía no está.
  // { name: 'Funnel', href: '/funnel', icon: ChartBarSquareIcon, roles: ['super_admin', 'admin', 'front_desk'] },
]

// Lo que hace funcionar la sede todos los días: con qué se cobra, quién atiende, quién entra.
const sedeNav = [
  { name: 'Membresías', href: '/membership-plans', icon: CreditCardIcon, roles: ['super_admin', 'admin'] },
  { name: 'Vendedores', href: '/sellers', icon: UsersIcon, roles: ['super_admin', 'admin'] },
  { name: 'Coaches', href: '/coaches', icon: AcademicCapIcon, roles: ['super_admin', 'admin'] },
  { name: 'Check-in', href: '/check-in', icon: QrCodeIcon, roles: ['super_admin', 'admin', 'front_desk'] },
  { name: 'Accesos', href: '/access-logs', icon: ClockIcon, roles: ['super_admin', 'admin'] },
]

// Cosas que se tocan una vez y afectan a todos: el sitio público y el alta de sedes nuevas.
// Antes las veía hasta un coach; ahora sólo super admin.
const superAdminNav = [
  { name: 'Contenido', href: '/content', icon: DocumentTextIcon, roles: ['super_admin'] },
  { name: 'Sedes', href: '/locations', icon: MapPinIcon, roles: ['super_admin'] },
]

// Negocio es su propio espacio: la pregunta "¿cómo venimos?" no se contesta en el medio de
// la operación del día. Dashboard y Métricas se unificaron en una sola pantalla.
const negocioNav = [
  { name: 'Métricas', href: '/negocio', icon: ChartBarSquareIcon, roles: ['super_admin', 'admin'] },
]

const catalogoNav = [
  { name: 'Catálogo', href: '/catalogo', icon: RectangleGroupIcon, roles: ['super_admin', 'admin', 'coach'] },
  { name: 'Rutinas', href: '/routines', icon: ClipboardDocumentListIcon, roles: ['super_admin', 'admin', 'coach'] },
  { name: 'Arquetipos', href: '/arquetipos', icon: UserGroupIcon, roles: ['super_admin', 'admin', 'coach'] },
  { name: 'Equipamiento', href: '/equipamiento', icon: WrenchScrewdriverIcon, roles: ['super_admin', 'admin', 'coach'] },
]

const queueNav = [
  { name: 'Monitor', href: '/lista-espera', icon: QueueListIcon, roles: ['super_admin', 'admin', 'front_desk'] },
  { name: 'Configuración', href: '/lista-espera/config', icon: Cog6ToothIcon, roles: ['super_admin', 'admin'] },
]

// Tres espacios bajo un mismo login, en vez de un menú con dieciocho cosas. Recepción, el
// dueño y el piso son trabajos distintos: quien cobra no abre el catálogo de ejercicios, y
// quien filma movimientos no mira la retención del mes. Separarlos hace que cada uno vea una
// lista corta de su propio trabajo en vez de scrollear por el de otro.
const ESPACIOS = [
  {
    id: 'gestion',
    nombre: 'Gestión',
    detalle: 'El día a día del gimnasio',
    icono: BuildingStorefrontIcon,
    grupos: [
      { items: hoyNav },
      { titulo: 'Usuarios', items: usuariosNav },
      { titulo: 'Sede', items: sedeNav },
      { titulo: 'Super Admin', items: superAdminNav },
    ],
  },
  {
    id: 'negocio',
    nombre: 'Negocio',
    detalle: 'Cómo viene el mes',
    icono: ChartBarSquareIcon,
    grupos: [{ items: negocioNav }],
  },
  {
    id: 'fitness',
    nombre: 'Fitness',
    detalle: 'Catálogo y pantallas',
    icono: BoltIcon,
    soloFitness: true,
    grupos: [
      { items: catalogoNav },
      { titulo: 'Lista de espera', items: queueNav },
    ],
  },
]

const Sidebar = ({ userRole, userEmail, mobileMenuOpen, onCloseMobileMenu, onLogout }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const selectorRef = useRef(null)

  const canSeeFitness = userEmail && FITNESS_ALLOWED_EMAILS.includes(userEmail.toLowerCase())

  const visibles = (items) => items.filter((i) => userRole && i.roles.includes(userRole))

  const espacios = ESPACIOS
    .filter((e) => !e.soloFitness || canSeeFitness)
    .map((e) => ({
      ...e,
      grupos: e.grupos
        .map((g) => ({ ...g, items: visibles(g.items) }))
        .filter((g) => g.items.length > 0),
    }))
    .filter((e) => e.grupos.length > 0)

  // Which space you are in is read from the URL, not remembered separately. Land on
  // /catalogo from a link or a refresh and the sidebar is already showing Fitness — a
  // stored preference would sooner or later disagree with the page you are looking at.
  const espacioActual =
    espacios.find((e) => e.grupos.some((g) => g.items.some((i) => location.pathname.startsWith(i.href)))) ??
    espacios[0]

  useEffect(() => {
    if (!abierto) return
    const fuera = (ev) => {
      if (selectorRef.current && !selectorRef.current.contains(ev.target)) setAbierto(false)
    }
    const escape = (ev) => ev.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  const handleNavClick = () => {
    if (onCloseMobileMenu) onCloseMobileMenu()
  }

  const cambiarEspacio = (espacio) => {
    setAbierto(false)
    if (espacio.id === espacioActual?.id) return
    // Switching lands on the first thing in that space rather than leaving the person on a
    // page that belongs to the space they just left.
    const primero = espacio.grupos[0]?.items[0]
    if (primero) {
      navigate(primero.href)
      handleNavClick()
    }
  }

  const SidebarContent = () => (
    // Sin fondo ni borde propios: el sidebar es el shell rojo que se ve a través de él.
    <div className="flex flex-col h-full px-2.5 pb-1.5">
      {/* Logo/Brand — el isologo real de TecnoFit (mismo trazo que el favicon de la web),
          blanco sobre el cuadrado invertido: el rojo de marca sobre rojo de marca no se veía. */}
      <div className="flex items-center justify-between h-12 px-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-[26px] h-[26px] bg-white rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 284 200" className="w-3.5 h-3.5 text-shell" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 45.97H72.88L36.34 199.37H103.56L158.52 125.68H229.83L246.24 79.69H176.41C158.49 79.69 143.57 83.96 129.12 95.89C122.8 101.1 117.4 107.33 112.84 114.14L95.97 139.29L119.55 45.98H267.46L283.24 0H12.62L0 45.97Z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-[15px] tracking-tight">TecnoFit</span>
        </div>
        <button
          onClick={onCloseMobileMenu}
          className="lg:hidden p-1 hover:bg-white/10 rounded-md transition-colors"
        >
          <XMarkIcon className="h-5 w-5 text-white/60" />
        </button>
      </div>

      {/* Selector de sede primero — es el contexto que enmarca todo lo demás (a qué gimnasio
          pertenece el equipamiento, los prospectos, la cola). Fitness/Gestión es una elección
          DENTRO de esa sede, así que va después, no antes. */}
      <SedeSwitcher />

      {/* Space switcher — only when there is more than one space to switch to */}
      {espacios.length > 1 && espacioActual && (
        <div className="pt-2.5" ref={selectorRef}>
          <div className="relative">
            <button
              onClick={() => setAbierto((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={abierto}
              className="w-full flex items-center gap-2.5 h-10 px-2.5 rounded-xl sidebar-surface hover:bg-white/[0.17] transition-colors"
            >
              <span className="w-[22px] h-[22px] rounded-md bg-white/15 flex items-center justify-center flex-shrink-0">
                <espacioActual.icono className="h-3.5 w-3.5 text-white" />
              </span>
              <span className="text-sm font-medium text-white flex-1 text-left truncate">
                {espacioActual.nombre}
              </span>
              <ChevronUpDownIcon className="h-4 w-4 text-white/60 flex-shrink-0" />
            </button>

            {abierto && (
              <div
                role="listbox"
                className="absolute left-0 right-0 mt-1.5 z-50 p-1.5 rounded-xl border border-white/20 bg-shell-deep shadow-xl"
              >
                {espacios.map((espacio) => {
                  const activo = espacio.id === espacioActual.id
                  return (
                    <button
                      key={espacio.id}
                      role="option"
                      aria-selected={activo}
                      onClick={() => cambiarEspacio(espacio)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
                        activo ? 'bg-white/[0.13]' : 'hover:bg-white/[0.08]'
                      }`}
                    >
                      <span className="w-[22px] h-[22px] rounded-md bg-white/15 flex items-center justify-center flex-shrink-0">
                        <espacio.icono className="h-3.5 w-3.5 text-white" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13.5px] font-medium text-white truncate">
                          {espacio.nombre}
                        </span>
                        <span className="block text-xs text-white/60 truncate">{espacio.detalle}</span>
                      </span>
                      {activo && <CheckIcon className="h-4 w-4 text-white flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 pt-3 space-y-0.5 overflow-y-auto">
        {espacioActual?.grupos.map((grupo, i) => (
          <div key={grupo.titulo ?? `grupo-${i}`} className="space-y-0.5">
            {grupo.titulo && <div className="sidebar-section">{grupo.titulo}</div>}
            {grupo.items.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleNavClick}
                  className={isActive ? 'sidebar-item-active' : 'sidebar-item'}
                >
                  <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer — "Cerrar sesión" bajó acá desde la barra de Header, que ya no existe. */}
      <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.12]">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
          <UserCircleIcon className="h-5 w-5 text-white/80" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-white truncate">Admin</p>
          <p className="text-xs text-white/60 truncate capitalize">{userRole?.replace('_', ' ') || 'User'}</p>
        </div>
        <button
          onClick={onLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="p-1 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <ArrowRightOnRectangleIcon className="h-[17px] w-[17px]" />
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/*
        Desktop Sidebar — pegado arriba: en una lista larga (rutinas, catálogo, socios) el menú
        se iba con el scroll y para cambiar de sección había que volver hasta arriba de todo.
        `self-start` es lo que hace que `sticky` funcione acá: sin eso el item flex se estira a
        la altura del contenido y nunca tiene margen para pegarse. La altura descuenta el padding
        del shell (2.5 arriba y abajo) para que no asome por debajo del borde redondeado.
      */}
      <div className="relative z-10 hidden lg:flex lg:flex-shrink-0 lg:sticky lg:top-2.5 lg:self-start lg:h-[calc(100vh-1.25rem)]">
        <div className="flex flex-col w-[236px] h-full">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onCloseMobileMenu} />
          {/* El panel mobile vive fuera del shell, así que se pinta el rojo él mismo. */}
          <div className="fixed inset-y-0 left-0 w-64 z-50 lg:hidden animate-slide-in-left bg-shell py-1.5">
            <SidebarContent />
          </div>
        </>
      )}
    </>
  )
}

export default Sidebar
