import { useState, useEffect } from 'react'
import { Bars3Icon } from '@heroicons/react/24/outline'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Prospects from './components/Prospects'
import Leads from './components/Leads'
import Users from './components/Users'
import Sellers from './components/Sellers'
import Coaches from './components/Coaches'
import Locations from './components/Locations'
import ContentManagement from './components/ContentManagement'
import MembershipPlans from './components/MembershipPlans'
import Exercises from './components/Exercises'
import Catalogo from './components/Catalogo'
import Equipamiento from './components/Equipamiento'
import Routines from './components/Routines'
import Arquetipos from './components/Arquetipos'
import CheckIn from './components/CheckIn'
import MemberAccess from './components/MemberAccess'
import AccessLogs from './components/AccessLogs'
import QueueMonitor from './components/QueueMonitor'
import QueueConfig from './components/QueueConfig'
import QueueTv from './components/QueueTv'
import Sidebar from './components/Sidebar'
import ShellGlow from './components/ShellGlow'
import { authService } from './services/authService'
import { SedeProvider } from './contexts/SedeContext'

// Emails allowed to see fitness section (beta feature)
const FITNESS_ALLOWED_EMAILS = ['mateoaldao@gmail.com', 'lucas@tecnofit.test']

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)
  const [userEmail, setUserEmail] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('admin_token')
        if (token) {
          const isValid = await authService.verifyToken(token)
          setIsAuthenticated(isValid)

          if (isValid) {
            const profile = await authService.getCurrentUserProfile()
            setUserRole(profile?.role || 'coach') // Fallback/Default
            setUserEmail(profile?.email || null)
          } else {
            localStorage.removeItem('admin_token')
          }
        } else {
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        const token = localStorage.getItem('admin_token')
        setIsAuthenticated(!!token)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const handleLogin = (token) => {
    localStorage.setItem('admin_token', token)
    setIsAuthenticated(true)
    // Update role and email immediately after login
    authService.getCurrentUserProfile().then(profile => {
      setUserRole(profile?.role)
      setUserEmail(profile?.email)
    })
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('userProfile')
    setIsAuthenticated(false)
    setUserRole(null)
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  // Check if user can see fitness features (email-restricted beta)
  const canSeeFitness = userEmail && FITNESS_ALLOWED_EMAILS.includes(userEmail.toLowerCase())

  // Permission Logic
  const canAccess = (route) => {
    if (!userRole) return false
    const role = userRole // 'super_admin', 'admin', 'front_desk', 'coach'

    // Fitness routes are restricted to specific emails
    if (['/exercises', '/routines', '/catalogo', '/equipamiento'].includes(route)) {
      return canSeeFitness
    }

    // Super Admin & Admin have full access
    if (role === 'super_admin' || role === 'admin') return true

    // Common restrictions for non-admins
    if (['/sellers', '/coaches', '/locations', '/membership-plans', '/access-logs', '/lista-espera/config'].includes(route)) return false

    // Seller (Front Desk)
    if (role === 'front_desk') {
      if (route === '/dashboard') return false
      return true // Access to prospects, leads, users, content
    }

    // Coach - has access to fitness features (but only if email is allowed)
    if (role === 'coach') {
      if (['/dashboard', '/leads', '/prospects'].includes(route)) return false
      return true // Access to users, content
    }

    return false
  }

  return (
    <Router>
      <Routes>
        {/* ─── Public standalone routes (no auth required) ─── */}
        <Route path="/check-in" element={<CheckIn />} />
        <Route path="/checkin" element={<CheckIn />} />
        <Route path="/acceso" element={<MemberAccess />} />
        <Route path="/lista-espera/tv/:lineaId" element={<QueueTv />} />

        {/* ─── All other routes — behind auth wall ─── */}
        <Route
          path="*"
          element={
            loading ? (
              <div className="min-h-screen bg-bg-primary flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  <span className="text-text-secondary text-sm">Cargando...</span>
                </div>
              </div>
            ) : !isAuthenticated ? (
              <Login onLogin={handleLogin} />
            ) : (
              <AuthenticatedShell
                userRole={userRole}
                userEmail={userEmail}
                mobileMenuOpen={mobileMenuOpen}
                onLogout={handleLogout}
                onMenuToggle={toggleMobileMenu}
                onCloseMobileMenu={closeMobileMenu}
                canAccess={canAccess}
              />
            )
          }
        />
      </Routes>
    </Router>
  )
}

function AuthenticatedShell({
  userRole,
  userEmail,
  mobileMenuOpen,
  onLogout,
  onMenuToggle,
  onCloseMobileMenu,
  canAccess,
}) {
  const canSeeFitness =
    userEmail && FITNESS_ALLOWED_EMAILS.includes(userEmail.toLowerCase())

  return (
    // El shell: rojo de marca con el resplandor detrás, y el contenido flotando encima en un
    // contenedor blanco redondeado. La barra global de Header desapareció — cada pantalla ya
    // trae su propio <h1> y sus acciones, y tener las dos cosas era un título arriba de otro.
    //
    // SedeProvider envuelve todo el shell autenticado: la sede activa es global a la
    // plataforma, no algo que cada pantalla resuelve por su cuenta.
    <SedeProvider>
    <div className="relative min-h-screen flex bg-shell p-2.5">
      <ShellGlow />
      <Sidebar
        userRole={userRole}
        userEmail={userEmail}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={onCloseMobileMenu}
        onLogout={onLogout}
      />
      <div className="relative z-10 flex-1 min-w-0 flex flex-col app-canvas">
        {/* El botón de menú vivía en Header. Sigue existiendo en mobile, ahora sobre el
            contenedor, porque sin él no hay forma de abrir el sidebar en pantalla chica. */}
        <button
          onClick={onMenuToggle}
          aria-label="Abrir menú"
          className="lg:hidden absolute top-4 left-4 z-20 p-2 text-text-secondary hover:text-text-primary hover:bg-bg-surface rounded-full transition-colors"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-6 lg:px-[30px] pt-6 pb-7 max-lg:pt-16">
            <Routes>
              <Route
                path="/"
                element={
                  <Navigate
                    to={canAccess('/dashboard') ? '/dashboard' : '/users'}
                    replace
                  />
                }
              />

              {canAccess('/dashboard') && (
                <Route path="/dashboard" element={<Dashboard />} />
              )}
              {canAccess('/prospects') && (
                <Route path="/prospects" element={<Prospects />} />
              )}
              {canAccess('/leads') && (
                <Route path="/leads" element={<Leads userRole={userRole} />} />
              )}
              {canAccess('/users') && (
                <Route path="/users" element={<Users />} />
              )}
              {canAccess('/membership-plans') && (
                <Route
                  path="/membership-plans"
                  element={<MembershipPlans userRole={userRole} />}
                />
              )}
              {canAccess('/sellers') && (
                <Route path="/sellers" element={<Sellers />} />
              )}
              {canAccess('/coaches') && (
                <Route path="/coaches" element={<Coaches />} />
              )}
              {canAccess('/locations') && (
                <Route path="/locations" element={<Locations />} />
              )}
              {canAccess('/content') && (
                <Route path="/content" element={<ContentManagement />} />
              )}

              {/* Fitness Routes */}
              {canSeeFitness && (
                <Route path="/exercises" element={<Exercises />} />
              )}
              {canSeeFitness && (
                <Route path="/catalogo" element={<Catalogo />} />
              )}
              {canSeeFitness && (
                <Route path="/routines" element={<Routines />} />
              )}
              {canSeeFitness && (
                <Route path="/arquetipos" element={<Arquetipos />} />
              )}
              {canSeeFitness && (
                <Route path="/equipamiento" element={<Equipamiento />} />
              )}

              {canAccess('/access-logs') && (
                <Route path="/access-logs" element={<AccessLogs />} />
              )}

              {/* Lista de Espera Routes */}
              {canAccess('/lista-espera') && (
                <Route path="/lista-espera" element={<QueueMonitor />} />
              )}
              {canAccess('/lista-espera/config') && (
                <Route path="/lista-espera/config" element={<QueueConfig />} />
              )}

              {/* Check-in also accessible while authenticated */}
              <Route path="/check-in" element={<CheckIn />} />

              {/* Fallback for unauthorized routes */}
              <Route
                path="*"
                element={
                  <Navigate
                    to={canAccess('/dashboard') ? '/dashboard' : '/users'}
                    replace
                  />
                }
              />
            </Routes>
          </div>
        </main>
      </div>
    </div>
    </SedeProvider>
  )
}

export default App
