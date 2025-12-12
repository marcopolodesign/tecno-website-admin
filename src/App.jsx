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

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('admin_token')
        if (token) {
          // Token exists in localStorage, verify it
          const isValid = await authService.verifyToken(token)
          setIsAuthenticated(isValid)
          
          if (!isValid) {
            // Token is invalid, clean up
            localStorage.removeItem('admin_token')
          }
        } else {
          // No token, user needs to login
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        // On error, check if token exists and keep user logged in
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
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    setIsAuthenticated(false)
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
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <Header onLogout={handleLogout} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/prospects" element={<Prospects />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/users" element={<Users />} />
                <Route path="/sellers" element={<Sellers />} />
                <Route path="/coaches" element={<Coaches />} />
                <Route path="/locations" element={<Locations />} />
                <Route path="/content" element={<ContentManagement />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </Router>
  )
}

export default App