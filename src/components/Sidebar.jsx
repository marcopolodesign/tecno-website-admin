import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
  ListBulletIcon,
  ClipboardDocumentListIcon,
  RectangleGroupIcon,
  // Lista de espera icons
  QueueListIcon,
  Cog6ToothIcon,
  // Space switcher
  ChevronUpDownIcon,
  CheckIcon,
  BuildingStorefrontIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'

// Emails allowed to see fitness section (beta feature)
const FITNESS_ALLOWED_EMAILS = ['mateoaldao@gmail.com']

const managementNav = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, roles: ['super_admin', 'admin'] },
  { name: 'Prospects', href: '/prospects', icon: EnvelopeIcon, roles: ['super_admin', 'admin', 'front_desk'] },
  { name: 'Leads', href: '/leads', icon: FunnelIcon, roles: ['super_admin', 'admin', 'front_desk'] },
  { name: 'Usuarios', href: '/users', icon: UserCircleIcon, roles: ['super_admin', 'admin', 'front_desk', 'coach'] },
  { name: 'Membresías', href: '/membership-plans', icon: CreditCardIcon, roles: ['super_admin', 'admin'] },
  { name: 'Vendedores', href: '/sellers', icon: UsersIcon, roles: ['super_admin', 'admin'] },
  { name: 'Coaches', href: '/coaches', icon: AcademicCapIcon, roles: ['super_admin', 'admin'] },
  { name: 'Sedes', href: '/locations', icon: MapPinIcon, roles: ['super_admin', 'admin'] },
  { name: 'Contenido', href: '/content', icon: DocumentTextIcon, roles: ['super_admin', 'admin', 'front_desk', 'coach'] },
  { name: 'Check-in', href: '/check-in', icon: QrCodeIcon, roles: ['super_admin', 'admin', 'front_desk'] },
  { name: 'Accesos', href: '/access-logs', icon: ClockIcon, roles: ['super_admin', 'admin'] },
]

const catalogoNav = [
  { name: 'Catálogo', href: '/catalogo', icon: RectangleGroupIcon, roles: ['super_admin', 'admin', 'coach'] },
  { name: 'Ejercicios', href: '/exercises', icon: ListBulletIcon, roles: ['super_admin', 'admin', 'coach'] },
  { name: 'Rutinas', href: '/routines', icon: ClipboardDocumentListIcon, roles: ['super_admin', 'admin', 'coach'] },
]

const queueNav = [
  { name: 'Monitor', href: '/lista-espera', icon: QueueListIcon, roles: ['super_admin', 'admin', 'front_desk'] },
  { name: 'Configuración', href: '/lista-espera/config', icon: Cog6ToothIcon, roles: ['super_admin', 'admin'] },
]

// Two products under one login, not one menu with eleven things in it. Front desk and the
// floor are different jobs: the person taking payments never touches the exercise catalog,
// and the coach filming movements never opens a membership. Splitting them means each
// person sees a short list of their own work instead of scrolling past someone else's.
const ESPACIOS = [
  {
    id: 'gestion',
    nombre: 'Gestión',
    detalle: 'Socios y ventas',
    icono: BuildingStorefrontIcon,
    grupos: [{ items: managementNav }],
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

const Sidebar = ({ userRole, userEmail, mobileMenuOpen, onCloseMobileMenu }) => {
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
    <div className="flex flex-col h-full bg-bg-secondary border-r border-border-default">
      {/* Logo/Brand */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border-default">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-brand rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">T</span>
          </div>
          <span className="text-text-primary font-semibold text-sm">TecnoFit</span>
        </div>
        <button
          onClick={onCloseMobileMenu}
          className="lg:hidden p-1 hover:bg-bg-surface rounded-md transition-colors"
        >
          <XMarkIcon className="h-5 w-5 text-text-secondary" />
        </button>
      </div>

      {/* Space switcher — only when there is more than one space to switch to */}
      {espacios.length > 1 && espacioActual && (
        <div className="px-2 pt-3" ref={selectorRef}>
          <div className="relative">
            <button
              onClick={() => setAbierto((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={abierto}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg border border-border-default bg-bg-secondary hover:bg-bg-surface transition-colors"
            >
              <span className="w-5 h-5 rounded bg-brand/10 flex items-center justify-center flex-shrink-0">
                <espacioActual.icono className="h-3.5 w-3.5 text-brand" />
              </span>
              <span className="text-sm font-medium text-text-primary flex-1 text-left truncate">
                {espacioActual.nombre}
              </span>
              <ChevronUpDownIcon className="h-4 w-4 text-text-tertiary flex-shrink-0" />
            </button>

            {abierto && (
              <div
                role="listbox"
                className="absolute left-0 right-0 mt-1 z-50 p-1 rounded-lg border border-border-default bg-bg-secondary shadow-lg"
              >
                {espacios.map((espacio) => {
                  const activo = espacio.id === espacioActual.id
                  return (
                    <button
                      key={espacio.id}
                      role="option"
                      aria-selected={activo}
                      onClick={() => cambiarEspacio(espacio)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-bg-surface transition-colors text-left"
                    >
                      <span className="w-5 h-5 rounded bg-brand/10 flex items-center justify-center flex-shrink-0">
                        <espacio.icono className="h-3.5 w-3.5 text-brand" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-text-primary truncate">
                          {espacio.nombre}
                        </span>
                        <span className="block text-xs text-text-tertiary truncate">{espacio.detalle}</span>
                      </span>
                      {activo && <CheckIcon className="h-4 w-4 text-brand flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {espacioActual?.grupos.map((grupo, i) => (
          <div key={grupo.titulo ?? `grupo-${i}`} className="space-y-1">
            {grupo.titulo && <div className={`section-header ${i > 0 ? 'mt-4' : ''}`}>{grupo.titulo}</div>}
            {grupo.items.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={handleNavClick}
                  className={isActive ? 'nav-item-active' : 'nav-item-inactive'}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-default">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-bg-surface rounded-full flex items-center justify-center">
            <UserCircleIcon className="h-5 w-5 text-text-tertiary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">Admin</p>
            <p className="text-xs text-text-tertiary truncate capitalize">{userRole?.replace('_', ' ') || 'User'}</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0 sticky top-0 h-screen">
        <div className="flex flex-col w-56">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onCloseMobileMenu} />
          <div className="fixed inset-y-0 left-0 w-64 z-50 lg:hidden animate-slide-in-left">
            <SidebarContent />
          </div>
        </>
      )}
    </>
  )
}

export default Sidebar
