import { useState, useEffect } from 'react'
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
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import { authService } from './services/authService'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)

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
    // Update role immediately after login
    authService.getCurrentUserProfile().then(profile => {
      setUserRole(profile?.role)
    })
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('userProfile')
    setIsAuthenticated(false)
    setUserRole(null)
  }

  // Permission Logic
  const canAccess = (route) => {
    if (!userRole) return false
    const role = userRole // 'super_admin', 'admin', 'front_desk', 'coach'

    // Super Admin & Admin have full access
    if (role === 'super_admin' || role === 'admin') return true

    // Common restrictions for non-admins
    if (['/sellers', '/coaches', '/locations'].includes(route)) return false

    // Seller (Front Desk)
    if (role === 'front_desk') {
      if (route === '/dashboard') return false
      return true // Access to prospects, leads, users, content
    }

    // Coach
    if (role === 'coach') {
      if (['/dashboard', '/leads', '/prospects'].includes(route)) return false
      return true // Access to users, content
    }

    return false
  }

  const ProtectedRoute = ({ path, element }) => {
    return canAccess(path) ? element : <Navigate to="/users" replace />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar userRole={userRole} />
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <Header onLogout={handleLogout} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Routes>
                <Route path="/" element={<Navigate to={canAccess('/dashboard') ? "/dashboard" : "/users"} replace />} />
                
                {canAccess('/dashboard') && <Route path="/dashboard" element={<Dashboard />} />}
                {canAccess('/prospects') && <Route path="/prospects" element={<Prospects />} />}
                {canAccess('/leads') && <Route path="/leads" element={<Leads />} />}
                {canAccess('/users') && <Route path="/users" element={<Users />} />}
                {canAccess('/sellers') && <Route path="/sellers" element={<Sellers />} />}
                {canAccess('/coaches') && <Route path="/coaches" element={<Coaches />} />}
                {canAccess('/locations') && <Route path="/locations" element={<Locations />} />}
                {canAccess('/content') && <Route path="/content" element={<ContentManagement />} />}
                
                {/* Fallback for unauthorized routes */}
                <Route path="*" element={<Navigate to={canAccess('/dashboard') ? "/dashboard" : "/users"} replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </Router>
  )
}

export default App