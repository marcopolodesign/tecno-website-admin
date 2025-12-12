import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

const Header = ({ onLogout }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Panel de Administración
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Bienvenido, Admin
            </div>
            <button
              onClick={onLogout}
              className="flex items-center text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
