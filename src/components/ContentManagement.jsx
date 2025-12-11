import { useState, useEffect } from 'react'
import { DocumentTextIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'

const ContentManagement = () => {
  const [activeTab, setActiveTab] = useState('homepage')
  const [homepageContent, setHomepageContent] = useState({
    heroTitle: '',
    heroSubtitle: '',
    heroDescription: '',
    aboutTitle: '',
    aboutContent: '',
    servicesTitle: '',
    servicesContent: '',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: ''
  })
  const [pricingContent, setPricingContent] = useState({
    title: '',
    subtitle: '',
    plans: []
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchContent()
  }, [])

  const fetchContent = async () => {
    setLoading(true)
    try {
      // Simulate API calls - replace with actual Strapi API calls
      setHomepageContent({
        heroTitle: 'Transforma tu cuerpo en TecnoFit',
        heroSubtitle: 'El gimnasio más moderno de Palermo con 5 boxes de entrenamiento',
        heroDescription: 'TecnoFit combina tecnología de vanguardia con entrenamiento personalizado para ofrecerte la mejor experiencia fitness en Palermo, Buenos Aires.',
        aboutTitle: '¿Por qué elegir TecnoFit?',
        aboutContent: 'En TecnoFit, ubicado en el corazón de Palermo, Buenos Aires, combinamos tecnología de vanguardia con entrenamiento personalizado para ofrecerte la mejor experiencia fitness.',
        servicesTitle: 'Nuestros Servicios',
        servicesContent: 'Ofrecemos una experiencia completa de fitness con tecnología de vanguardia y atención personalizada en Palermo, Buenos Aires.',
        seoTitle: 'TecnoFit - Gimnasio en Palermo, Buenos Aires | Entrenamiento Personal',
        seoDescription: 'TecnoFit es el mejor gimnasio en Palermo, Buenos Aires. 5 boxes de entrenamiento, planes personalizados y entrenadores profesionales.',
        seoKeywords: 'gimnasio palermo, gimnasio buenos aires, entrenamiento personal palermo, fitness palermo, musculación palermo'
      })
      
      setPricingContent({
        title: 'Nuestros Planes',
        subtitle: 'Elige el plan que mejor se adapte a tus objetivos y estilo de vida.',
        plans: [
          {
            name: 'Básico',
            price: '15000',
            description: 'Perfecto para comenzar tu transformación',
            features: ['Acceso a 3 box', 'Horario limitado', 'App móvil básica']
          },
          {
            name: 'Premium',
            price: '25000',
            description: 'El plan más popular para resultados óptimos',
            features: ['Acceso a todas las 5 boxes', 'Acceso 24/7', 'App móvil completa']
          },
          {
            name: 'VIP',
            price: '40000',
            description: 'Experiencia completa con entrenador personal',
            features: ['Todo lo del plan Premium', 'Entrenamiento personal ilimitado', 'Plan nutricional personalizado']
          }
        ]
      })
    } catch (error) {
      console.error('Error fetching content:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleHomepageSave = async () => {
    setLoading(true)
    try {
      // Simulate API call - replace with actual Strapi API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving homepage content:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePricingSave = async () => {
    setLoading(true)
    try {
      // Simulate API call - replace with actual Strapi API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving pricing content:', error)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'homepage', name: 'Página Principal', icon: DocumentTextIcon },
    { id: 'pricing', name: 'Precios', icon: CurrencyDollarIcon }
  ]

  if (loading && !homepageContent.heroTitle) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Contenido</h1>
        <p className="text-gray-600">Administra el contenido de tu sitio web</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Homepage Content */}
      {activeTab === 'homepage' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Contenido Principal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="form-label">Título Principal</label>
                <input
                  type="text"
                  className="form-input"
                  value={homepageContent.heroTitle}
                  onChange={(e) => setHomepageContent({...homepageContent, heroTitle: e.target.value})}
                />
              </div>
              <div>
                <label className="form-label">Subtítulo</label>
                <input
                  type="text"
                  className="form-input"
                  value={homepageContent.heroSubtitle}
                  onChange={(e) => setHomepageContent({...homepageContent, heroSubtitle: e.target.value})}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="form-label">Descripción Principal</label>
              <textarea
                className="form-input"
                rows={3}
                value={homepageContent.heroDescription}
                onChange={(e) => setHomepageContent({...homepageContent, heroDescription: e.target.value})}
              />
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Sección Nosotros</h3>
            <div className="space-y-4">
              <div>
                <label className="form-label">Título de la Sección</label>
                <input
                  type="text"
                  className="form-input"
                  value={homepageContent.aboutTitle}
                  onChange={(e) => setHomepageContent({...homepageContent, aboutTitle: e.target.value})}
                />
              </div>
              <div>
                <label className="form-label">Contenido</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={homepageContent.aboutContent}
                  onChange={(e) => setHomepageContent({...homepageContent, aboutContent: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">SEO</h3>
            <div className="space-y-4">
              <div>
                <label className="form-label">Título SEO</label>
                <input
                  type="text"
                  className="form-input"
                  value={homepageContent.seoTitle}
                  onChange={(e) => setHomepageContent({...homepageContent, seoTitle: e.target.value})}
                />
              </div>
              <div>
                <label className="form-label">Descripción SEO</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={homepageContent.seoDescription}
                  onChange={(e) => setHomepageContent({...homepageContent, seoDescription: e.target.value})}
                />
              </div>
              <div>
                <label className="form-label">Palabras Clave</label>
                <input
                  type="text"
                  className="form-input"
                  value={homepageContent.seoKeywords}
                  onChange={(e) => setHomepageContent({...homepageContent, seoKeywords: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleHomepageSave}
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>

          {saved && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-sm text-green-600">Contenido guardado exitosamente</p>
            </div>
          )}
        </div>
      )}

      {/* Pricing Content */}
      {activeTab === 'pricing' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Información de Precios</h3>
            <div className="space-y-4">
              <div>
                <label className="form-label">Título de la Sección</label>
                <input
                  type="text"
                  className="form-input"
                  value={pricingContent.title}
                  onChange={(e) => setPricingContent({...pricingContent, title: e.target.value})}
                />
              </div>
              <div>
                <label className="form-label">Subtítulo</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={pricingContent.subtitle}
                  onChange={(e) => setPricingContent({...pricingContent, subtitle: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Planes de Precios</h3>
            <div className="space-y-6">
              {pricingContent.plans.map((plan, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">Nombre del Plan</label>
                      <input
                        type="text"
                        className="form-input"
                        value={plan.name}
                        onChange={(e) => {
                          const newPlans = [...pricingContent.plans]
                          newPlans[index].name = e.target.value
                          setPricingContent({...pricingContent, plans: newPlans})
                        }}
                      />
                    </div>
                    <div>
                      <label className="form-label">Precio (ARS)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={plan.price}
                        onChange={(e) => {
                          const newPlans = [...pricingContent.plans]
                          newPlans[index].price = e.target.value
                          setPricingContent({...pricingContent, plans: newPlans})
                        }}
                      />
                    </div>
                    <div>
                      <label className="form-label">Descripción</label>
                      <input
                        type="text"
                        className="form-input"
                        value={plan.description}
                        onChange={(e) => {
                          const newPlans = [...pricingContent.plans]
                          newPlans[index].description = e.target.value
                          setPricingContent({...pricingContent, plans: newPlans})
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handlePricingSave}
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>

          {saved && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-sm text-green-600">Contenido guardado exitosamente</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ContentManagement
