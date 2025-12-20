import { useState, useEffect } from 'react'
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  XMarkIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import exercisesService from '../services/exercisesService'
import toast, { Toaster } from 'react-hot-toast'
import { toastOptions } from '../lib/themeStyles'

export default function Exercises() {
  const [bodyZones, setBodyZones] = useState([])
  const [categories, setCategories] = useState([])
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('exercises') // 'exercises', 'categories', 'zones'
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedZone, setSelectedZone] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  
  // Modals
  const [showExerciseModal, setShowExerciseModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [saving, setSaving] = useState(false)

  // Expanded zones in tree view
  const [expandedZones, setExpandedZones] = useState({})

  // Form states
  const [exerciseForm, setExerciseForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    instructions: '',
    targetMuscles: [],
    equipmentNeeded: [],
    difficultyLevel: 'intermediate',
    estimatedDuration: 0
  })

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    bodyZoneId: '',
    description: '',
    displayOrder: 1
  })

  const [zoneForm, setZoneForm] = useState({
    name: '',
    description: '',
    displayOrder: 1
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [zonesRes, categoriesRes, exercisesRes] = await Promise.all([
        exercisesService.getBodyZones(),
        exercisesService.getCategories(),
        exercisesService.getExercises()
      ])
      setBodyZones(zonesRes.data)
      setCategories(categoriesRes.data)
      setExercises(exercisesRes.data)
      
      // Expand all zones by default
      const expanded = {}
      zonesRes.data.forEach(z => { expanded[z.id] = true })
      setExpandedZones(expanded)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error al cargar datos', toastOptions)
    } finally {
      setLoading(false)
    }
  }

  // Filter exercises
  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = !searchQuery || 
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesZone = !selectedZone || 
      ex.exerciseCategories?.bodyZones?.id === parseInt(selectedZone)
    
    const matchesCategory = !selectedCategory || 
      ex.categoryId === parseInt(selectedCategory)
    
    return matchesSearch && matchesZone && matchesCategory
  })

  // Filter categories by zone
  const filteredCategories = selectedZone 
    ? categories.filter(c => c.bodyZoneId === parseInt(selectedZone))
    : categories

  // Group exercises by zone and category for tree view
  const exerciseTree = bodyZones.map(zone => ({
    ...zone,
    categories: categories
      .filter(c => c.bodyZoneId === zone.id)
      .map(cat => ({
        ...cat,
        exercises: exercises.filter(e => e.categoryId === cat.id)
      }))
  }))

  // Toggle zone expansion
  const toggleZone = (zoneId) => {
    setExpandedZones(prev => ({ ...prev, [zoneId]: !prev[zoneId] }))
  }

  // Exercise Modal Handlers
  const openExerciseModal = (exercise = null) => {
    if (exercise) {
      setEditingItem(exercise)
      setExerciseForm({
        name: exercise.name,
        description: exercise.description || '',
        categoryId: exercise.categoryId,
        instructions: exercise.instructions || '',
        targetMuscles: exercise.targetMuscles || [],
        equipmentNeeded: exercise.equipmentNeeded || [],
        difficultyLevel: exercise.difficultyLevel || 'intermediate',
        estimatedDuration: exercise.estimatedDuration || 0
      })
    } else {
      setEditingItem(null)
      setExerciseForm({
        name: '',
        description: '',
        categoryId: '',
        instructions: '',
        targetMuscles: [],
        equipmentNeeded: [],
        difficultyLevel: 'intermediate',
        estimatedDuration: 0
      })
    }
    setShowExerciseModal(true)
  }

  const saveExercise = async (e) => {
    e.preventDefault()
    if (!exerciseForm.name || !exerciseForm.categoryId) {
      toast.error('Nombre y categoría son requeridos', toastOptions)
      return
    }

    try {
      setSaving(true)
      if (editingItem) {
        await exercisesService.updateExercise(editingItem.id, exerciseForm)
        toast.success('Ejercicio actualizado', toastOptions)
      } else {
        await exercisesService.createExercise(exerciseForm)
        toast.success('Ejercicio creado', toastOptions)
      }
      setShowExerciseModal(false)
      fetchData()
    } catch (error) {
      console.error('Error saving exercise:', error)
      toast.error('Error al guardar ejercicio', toastOptions)
    } finally {
      setSaving(false)
    }
  }

  const deleteExercise = async (id) => {
    if (!confirm('¿Eliminar este ejercicio?')) return
    try {
      await exercisesService.deleteExercise(id)
      toast.success('Ejercicio eliminado', toastOptions)
      fetchData()
    } catch (error) {
      toast.error('Error al eliminar', toastOptions)
    }
  }

  // Category Modal Handlers
  const openCategoryModal = (category = null) => {
    if (category) {
      setEditingItem(category)
      setCategoryForm({
        name: category.name,
        bodyZoneId: category.bodyZoneId,
        description: category.description || '',
        displayOrder: category.displayOrder || 1
      })
    } else {
      setEditingItem(null)
      setCategoryForm({
        name: '',
        bodyZoneId: '',
        description: '',
        displayOrder: categories.length + 1
      })
    }
    setShowCategoryModal(true)
  }

  const saveCategory = async (e) => {
    e.preventDefault()
    if (!categoryForm.name || !categoryForm.bodyZoneId) {
      toast.error('Nombre y zona son requeridos', toastOptions)
      return
    }

    try {
      setSaving(true)
      if (editingItem) {
        await exercisesService.updateCategory(editingItem.id, categoryForm)
        toast.success('Categoría actualizada', toastOptions)
      } else {
        await exercisesService.createCategory(categoryForm)
        toast.success('Categoría creada', toastOptions)
      }
      setShowCategoryModal(false)
      fetchData()
    } catch (error) {
      console.error('Error saving category:', error)
      toast.error('Error al guardar categoría', toastOptions)
    } finally {
      setSaving(false)
    }
  }

  const deleteCategory = async (id) => {
    if (!confirm('¿Eliminar esta categoría? Los ejercicios asociados también se eliminarán.')) return
    try {
      await exercisesService.deleteCategory(id)
      toast.success('Categoría eliminada', toastOptions)
      fetchData()
    } catch (error) {
      toast.error('Error al eliminar', toastOptions)
    }
  }

  // Zone Modal Handlers
  const openZoneModal = (zone = null) => {
    if (zone) {
      setEditingItem(zone)
      setZoneForm({
        name: zone.name,
        description: zone.description || '',
        displayOrder: zone.displayOrder || 1
      })
    } else {
      setEditingItem(null)
      setZoneForm({
        name: '',
        description: '',
        displayOrder: bodyZones.length + 1
      })
    }
    setShowZoneModal(true)
  }

  const saveZone = async (e) => {
    e.preventDefault()
    if (!zoneForm.name) {
      toast.error('Nombre es requerido', toastOptions)
      return
    }

    try {
      setSaving(true)
      if (editingItem) {
        await exercisesService.updateBodyZone(editingItem.id, zoneForm)
        toast.success('Zona actualizada', toastOptions)
      } else {
        await exercisesService.createBodyZone(zoneForm)
        toast.success('Zona creada', toastOptions)
      }
      setShowZoneModal(false)
      fetchData()
    } catch (error) {
      console.error('Error saving zone:', error)
      toast.error('Error al guardar zona', toastOptions)
    } finally {
      setSaving(false)
    }
  }

  const deleteZone = async (id) => {
    if (!confirm('¿Eliminar esta zona? Las categorías y ejercicios asociados también se eliminarán.')) return
    try {
      await exercisesService.deleteBodyZone(id)
      toast.success('Zona eliminada', toastOptions)
      fetchData()
    } catch (error) {
      toast.error('Error al eliminar', toastOptions)
    }
  }

  const getDifficultyBadge = (level) => {
    const styles = {
      beginner: 'bg-green-100 text-green-700',
      intermediate: 'bg-yellow-100 text-yellow-700',
      advanced: 'bg-red-100 text-red-700'
    }
    const labels = {
      beginner: 'Principiante',
      intermediate: 'Intermedio',
      advanced: 'Avanzado'
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[level] || styles.intermediate}`}>
        {labels[level] || level}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Biblioteca de Ejercicios</h1>
          <p className="text-sm text-text-secondary mt-1">
            {exercises.length} ejercicios en {categories.length} categorías
          </p>
        </div>
        <button
          onClick={() => openExerciseModal()}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo Ejercicio
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-bg-surface rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('exercises')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'exercises' 
              ? 'bg-white text-brand shadow-sm' 
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Ejercicios
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'categories' 
              ? 'bg-white text-brand shadow-sm' 
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Categorías
        </button>
        <button
          onClick={() => setActiveTab('zones')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'zones' 
              ? 'bg-white text-brand shadow-sm' 
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Zonas Corporales
        </button>
      </div>

      {/* Exercises Tab */}
      {activeTab === 'exercises' && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="Buscar ejercicio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input pl-9"
              />
            </div>
            <select
              value={selectedZone}
              onChange={(e) => {
                setSelectedZone(e.target.value)
                setSelectedCategory('')
              }}
              className="form-select"
            >
              <option value="">Todas las zonas</option>
              {bodyZones.map(zone => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="form-select"
            >
              <option value="">Todas las categorías</option>
              {filteredCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Exercise Tree View */}
          <div className="space-y-2">
            {exerciseTree.map(zone => {
              const zoneExerciseCount = zone.categories.reduce((sum, c) => sum + c.exercises.length, 0)
              if (zoneExerciseCount === 0 && (selectedZone || selectedCategory || searchQuery)) return null
              
              return (
                <div key={zone.id} className="card p-0 overflow-hidden">
                  {/* Zone Header */}
                  <button
                    onClick={() => toggleZone(zone.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-bg-surface transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedZones[zone.id] ? (
                        <ChevronDownIcon className="h-5 w-5 text-text-tertiary" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-text-tertiary" />
                      )}
                      <div className="w-8 h-8 bg-brand/10 rounded-lg flex items-center justify-center">
                        <span className="text-brand font-bold text-sm">{zone.name.charAt(0)}</span>
                      </div>
                      <div className="text-left">
                        <h3 className="font-medium text-text-primary">{zone.name}</h3>
                        <p className="text-xs text-text-secondary">{zoneExerciseCount} ejercicios</p>
                      </div>
                    </div>
                  </button>

                  {/* Zone Content */}
                  {expandedZones[zone.id] && (
                    <div className="border-t border-border-default">
                      {zone.categories.map(cat => {
                        const catExercises = cat.exercises.filter(ex => {
                          const matchesSearch = !searchQuery || 
                            ex.name.toLowerCase().includes(searchQuery.toLowerCase())
                          const matchesCat = !selectedCategory || ex.categoryId === parseInt(selectedCategory)
                          return matchesSearch && matchesCat
                        })
                        
                        if (catExercises.length === 0 && searchQuery) return null

                        return (
                          <div key={cat.id} className="border-b border-border-default last:border-b-0">
                            <div className="px-4 py-2 bg-bg-surface/50 flex items-center justify-between">
                              <span className="text-sm font-medium text-text-secondary">{cat.name}</span>
                              <span className="text-xs text-text-tertiary">{catExercises.length}</span>
                            </div>
                            <div className="divide-y divide-border-default">
                              {catExercises.map(exercise => (
                                <div key={exercise.id} className="px-4 py-3 flex items-center justify-between hover:bg-bg-surface/30">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-text-primary">{exercise.name}</span>
                                      {getDifficultyBadge(exercise.difficultyLevel)}
                                    </div>
                                    {exercise.description && (
                                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{exercise.description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => openExerciseModal(exercise)}
                                      className="p-1.5 text-text-tertiary hover:text-brand hover:bg-brand/10 rounded transition-colors"
                                    >
                                      <PencilIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteExercise(exercise.id)}
                                      className="p-1.5 text-text-tertiary hover:text-error hover:bg-error/10 rounded transition-colors"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {catExercises.length === 0 && (
                                <div className="px-4 py-3 text-sm text-text-tertiary text-center">
                                  Sin ejercicios
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openCategoryModal()}
              className="btn-secondary flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Nueva Categoría
            </button>
          </div>
          
          <div className="grid gap-3">
            {bodyZones.map(zone => (
              <div key={zone.id} className="card">
                <h3 className="font-medium text-text-primary mb-3">{zone.name}</h3>
                <div className="space-y-2">
                  {categories.filter(c => c.bodyZoneId === zone.id).map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-bg-surface rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-text-primary">{cat.name}</span>
                        {cat.description && (
                          <p className="text-xs text-text-secondary">{cat.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openCategoryModal(cat)}
                          className="p-1.5 text-text-tertiary hover:text-brand hover:bg-brand/10 rounded transition-colors"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          className="p-1.5 text-text-tertiary hover:text-error hover:bg-error/10 rounded transition-colors"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {categories.filter(c => c.bodyZoneId === zone.id).length === 0 && (
                    <p className="text-sm text-text-tertiary text-center py-2">Sin categorías</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zones Tab */}
      {activeTab === 'zones' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => openZoneModal()}
              className="btn-secondary flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Nueva Zona
            </button>
          </div>
          
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bodyZones.map(zone => {
              const zoneCats = categories.filter(c => c.bodyZoneId === zone.id)
              const zoneExCount = exercises.filter(e => zoneCats.some(c => c.id === e.categoryId)).length
              
              return (
                <div key={zone.id} className="card">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-brand/10 rounded-lg flex items-center justify-center">
                      <span className="text-brand font-bold">{zone.name.charAt(0)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openZoneModal(zone)}
                        className="p-1.5 text-text-tertiary hover:text-brand hover:bg-brand/10 rounded transition-colors"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteZone(zone.id)}
                        className="p-1.5 text-text-tertiary hover:text-error hover:bg-error/10 rounded transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-medium text-text-primary">{zone.name}</h3>
                  {zone.description && (
                    <p className="text-sm text-text-secondary mt-1">{zone.description}</p>
                  )}
                  <div className="flex gap-4 mt-3 pt-3 border-t border-border-default">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-text-primary">{zoneCats.length}</p>
                      <p className="text-xs text-text-tertiary">Categorías</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-text-primary">{zoneExCount}</p>
                      <p className="text-xs text-text-tertiary">Ejercicios</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Exercise Modal */}
      {showExerciseModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowExerciseModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-bg-secondary rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between p-4 border-b border-border-default">
                <h2 className="text-lg font-semibold text-text-primary">
                  {editingItem ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
                </h2>
                <button onClick={() => setShowExerciseModal(false)} className="p-1 hover:bg-bg-surface rounded">
                  <XMarkIcon className="h-5 w-5 text-text-secondary" />
                </button>
              </div>
              
              <form onSubmit={saveExercise} className="p-4 space-y-4">
                <div>
                  <label className="form-label">Nombre *</label>
                  <input
                    type="text"
                    value={exerciseForm.name}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, name: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Categoría *</label>
                  <select
                    value={exerciseForm.categoryId}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, categoryId: e.target.value })}
                    className="form-select"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {bodyZones.map(zone => (
                      <optgroup key={zone.id} label={zone.name}>
                        {categories.filter(c => c.bodyZoneId === zone.id).map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Descripción</label>
                  <textarea
                    value={exerciseForm.description}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, description: e.target.value })}
                    className="form-textarea"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="form-label">Instrucciones</label>
                  <textarea
                    value={exerciseForm.instructions}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, instructions: e.target.value })}
                    className="form-textarea"
                    rows={3}
                    placeholder="Pasos para realizar el ejercicio..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Dificultad</label>
                    <select
                      value={exerciseForm.difficultyLevel}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, difficultyLevel: e.target.value })}
                      className="form-select"
                    >
                      <option value="beginner">Principiante</option>
                      <option value="intermediate">Intermedio</option>
                      <option value="advanced">Avanzado</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Duración (min)</label>
                    <input
                      type="number"
                      value={exerciseForm.estimatedDuration}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, estimatedDuration: parseInt(e.target.value) || 0 })}
                      className="form-input"
                      min="0"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                  <button type="button" onClick={() => setShowExerciseModal(false)} className="btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowCategoryModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-bg-secondary rounded-lg shadow-xl max-w-md w-full animate-fade-in">
              <div className="flex items-center justify-between p-4 border-b border-border-default">
                <h2 className="text-lg font-semibold text-text-primary">
                  {editingItem ? 'Editar Categoría' : 'Nueva Categoría'}
                </h2>
                <button onClick={() => setShowCategoryModal(false)} className="p-1 hover:bg-bg-surface rounded">
                  <XMarkIcon className="h-5 w-5 text-text-secondary" />
                </button>
              </div>
              
              <form onSubmit={saveCategory} className="p-4 space-y-4">
                <div>
                  <label className="form-label">Zona Corporal *</label>
                  <select
                    value={categoryForm.bodyZoneId}
                    onChange={(e) => setCategoryForm({ ...categoryForm, bodyZoneId: e.target.value })}
                    className="form-select"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {bodyZones.map(zone => (
                      <option key={zone.id} value={zone.id}>{zone.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Nombre *</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Descripción</label>
                  <textarea
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    className="form-textarea"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                  <button type="button" onClick={() => setShowCategoryModal(false)} className="btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Zone Modal */}
      {showZoneModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowZoneModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-bg-secondary rounded-lg shadow-xl max-w-md w-full animate-fade-in">
              <div className="flex items-center justify-between p-4 border-b border-border-default">
                <h2 className="text-lg font-semibold text-text-primary">
                  {editingItem ? 'Editar Zona' : 'Nueva Zona Corporal'}
                </h2>
                <button onClick={() => setShowZoneModal(false)} className="p-1 hover:bg-bg-surface rounded">
                  <XMarkIcon className="h-5 w-5 text-text-secondary" />
                </button>
              </div>
              
              <form onSubmit={saveZone} className="p-4 space-y-4">
                <div>
                  <label className="form-label">Nombre *</label>
                  <input
                    type="text"
                    value={zoneForm.name}
                    onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                    className="form-input"
                    placeholder="Ej: Tren Superior, Core..."
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Descripción</label>
                  <textarea
                    value={zoneForm.description}
                    onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })}
                    className="form-textarea"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                  <button type="button" onClick={() => setShowZoneModal(false)} className="btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

