import { Link, useLocation } from 'react-router-dom'
import { 
  HomeIcon, 
  UserGroupIcon, 
  DocumentTextIcon,
  EnvelopeIcon,
  UserCircleIcon,
  FunnelIcon,
  UsersIcon,
  AcademicCapIcon,
  MapPinIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline'

const Sidebar = ({ userRole }) => {
  const location = useLocation()

  const allNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, roles: ['super_admin', 'admin'] },
    { name: 'Prospects', href: '/prospects', icon: EnvelopeIcon, roles: ['super_admin', 'admin', 'front_desk'] },
    { name: 'Leads', href: '/leads', icon: FunnelIcon, roles: ['super_admin', 'admin', 'front_desk'] },
    { name: 'Usuarios', href: '/users', icon: UserCircleIcon, roles: ['super_admin', 'admin', 'front_desk', 'coach'] },
    { name: 'Membresías', href: '/membership-plans', icon: CreditCardIcon, roles: ['super_admin', 'admin'] },
    { name: 'Vendedores', href: '/sellers', icon: UsersIcon, roles: ['super_admin', 'admin'] },
    { name: 'Coaches', href: '/coaches', icon: AcademicCapIcon, roles: ['super_admin', 'admin'] },
    { name: 'Sedes', href: '/locations', icon: MapPinIcon, roles: ['super_admin', 'admin'] },
    { name: 'Contenido', href: '/content', icon: DocumentTextIcon, roles: ['super_admin', 'admin', 'front_desk', 'coach'] },
  ]

  const navigation = allNavigation.filter(item => {
    if (!userRole) return false
    return item.roles.includes(userRole)
  })

  return (
    <div className="hidden lg:flex lg:flex-shrink-0 sticky top-0 h-screen">
      <div className="flex flex-col w-56">
        <div className="flex flex-col h-full bg-bg-secondary border-r border-border-default">
          {/* Logo/Brand */}
          <div className="flex items-center h-14 px-4 border-b border-border-default">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-brand rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">T</span>
              </div>
              <span className="text-text-primary font-semibold text-sm">TecnoFit</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            <div className="section-header">Gestión</div>
            
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={isActive ? 'nav-item-active' : 'nav-item-inactive'}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
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
      </div>
    </div>
  )
}

export default Sidebar
