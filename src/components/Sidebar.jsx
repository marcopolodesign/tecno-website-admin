import { Link, useLocation } from 'react-router-dom'
import { 
  HomeIcon, 
  UserGroupIcon, 
  DocumentTextIcon,
  ChartBarIcon,
  EnvelopeIcon,
  UserCircleIcon,
  FunnelIcon,
  UsersIcon,
  AcademicCapIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'

const Sidebar = () => {
  const location = useLocation()

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Prospects', href: '/prospects', icon: EnvelopeIcon },
    { name: 'Leads', href: '/leads', icon: FunnelIcon },
    { name: 'Usuarios', href: '/users', icon: UserCircleIcon },
    { name: 'Vendedores', href: '/sellers', icon: UsersIcon },
    { name: 'Coaches', href: '/coaches', icon: AcademicCapIcon },
    { name: 'Sedes', href: '/locations', icon: MapPinIcon },
    { name: 'Contenido', href: '/content', icon: DocumentTextIcon },
  ]

  return (
    <div className="hidden lg:flex lg:flex-shrink-0 sticky top-0 h-screen">
      <div className="flex flex-col w-64">
        <div className="flex flex-col h-0 flex-1 bg-white border-r border-gray-200">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <h1 className="text-xl font-bold text-sky-600">
                TecnoFit Admin
              </h1>
            </div>
            <nav className="mt-5 flex-1 px-2 space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? 'bg-sky-100 text-sky-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 flex-shrink-0 h-6 w-6 ${
                        isActive ? 'text-sky-500' : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
