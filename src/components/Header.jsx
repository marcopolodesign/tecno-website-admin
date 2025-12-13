import { ArrowRightOnRectangleIcon, Bars3Icon, BellIcon } from '@heroicons/react/24/outline'

const Header = ({ onLogout, onMenuToggle }) => {
  return (
    <header className="bg-bg-secondary border-b border-border-default flex-shrink-0 z-30">
      <div className="px-4 lg:px-6">
        <div className="flex justify-between items-center h-14">
          {/* Left side */}
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button 
              onClick={onMenuToggle}
              className="lg:hidden p-2 text-text-secondary hover:text-text-primary hover:bg-bg-surface rounded-md transition-colors"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            
            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-2">
              <span className="text-text-primary font-medium text-sm">Panel de Administración</span>
            </div>
          </div>
          
          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-surface rounded-md transition-colors">
              <BellIcon className="h-5 w-5" />
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-border-default mx-2" />

            {/* Logout button */}
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-surface rounded-md transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
