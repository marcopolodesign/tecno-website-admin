import { useState, useEffect } from 'react'
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  XMarkIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  CalendarIcon,
  UserIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlayIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline'
import routinesService from '../services/routinesService'
import exercisesService from '../services/exercisesService'
import { supabase, toCamelCase } from '../lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { toastOptions } from '../lib/themeStyles'

export default function Routines() {
  const [routines, setRoutines] = useState([])
  const [users, setUsers] = useState([])
  const [exercises, setExercises] = useState([])
  const [categories, setCategories] = useState([])
  const [bodyZones, setBodyZones] = useState([])
  const [boxes, setBoxes] = useState([]) // Gym stations
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  
  // Selected routine for detail view
  const [selectedRoutine, setSelectedRoutine] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  
  // Modals
  const [showRoutineModal, setShowRoutineModal] = useState(false)
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [showExerciseModal, setShowExerciseModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form states
  const [routineForm, setRoutineForm] = useState({
    clientId: '',
    title: '',
    description: '',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    goal: ''
  })

  const [sessionForm, setSessionForm] = useState({
    routineId: null,
    sessionNumber: 1,
    title: '',
    description: ''
  })

  const [exerciseForm, setExerciseForm] = useState({
    sessionId: null,
    exerciseId: '',
    boxId: '',
    boxNumber: '',
    setsReps: '3x12',
    restTime: '60s',
    repetitionTime: '',
    weightKg: '',
    microPause: '',
    notes: ''
  })

  // Expanded sessions
  const [expandedSessions, setExpandedSessions] = useState({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [routinesRes, usersRes, exercisesRes, categoriesRes, zonesRes, boxesRes] = await Promise.all([
        routinesService.getRoutines(),
        supabase.from('users').select('id, first_name, last_name, email, training_goal').order('first_name'),
        exercisesService.getExercises(),
        exercisesService.getCategories(),
        exercisesService.getBodyZones(),
        routinesService.getBoxes()
      ])
      
      setRoutines(routinesRes.data || [])
      setUsers(toCamelCase(usersRes.data) || [])
      setExercises(exercisesRes.data || [])
      setCategories(categoriesRes.data || [])
      setBodyZones(zonesRes.data || [])
      setBoxes(boxesRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error al cargar datos', toastOptions)
    } finally {
      setLoading(false)
    }
  }

  const fetchRoutineDetail = async (routineId) => {
    try {
      setLoadingDetail(true)
      const { data } = await routinesService.getRoutine(routineId)
      setSelectedRoutine(data)
      
      // Expand first session by default
      if (data.routineSessions?.length > 0) {
        setExpandedSessions({ [data.routineSessions[0].id]: true })
      }
    } catch (error) {
      console.error('Error fetching routine detail:', error)
      toast.error('Error al cargar rutina', toastOptions)
    } finally {
      setLoadingDetail(false)
    }
  }

  // Filter routines
  const filteredRoutines = routines.filter(r => {
    const matchesSearch = !searchQuery || 
      r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.users?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.users?.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = !statusFilter || r.status === statusFilter
    const matchesClient = !clientFilter || r.clientId === clientFilter
    
    return matchesSearch && matchesStatus && matchesClient
  })

  const getStatusBadge = (status) => {
    const styles = {
      active: 'status-activo',
      completed: 'status-convertido',
      expired: 'status-perdido',
      paused: 'status-contactado'
    }
    const labels = {
      active: 'Activa',
      completed: 'Completada',
      expired: 'Expirada',
      paused: 'Pausada'
    }
    return (
      <span className={`status-badge ${styles[status] || 'status-nuevo'}`}>
        {labels[status] || status}
      </span>
    )
  }

  const toggleSession = (sessionId) => {
    setExpandedSessions(prev => ({ ...prev, [sessionId]: !prev[sessionId] }))
  }

  // Routine Modal Handlers
  const openRoutineModal = (routine = null) => {
    if (routine) {
      // When editing, get the goal from the user's profile
      const routineUser = users.find(u => u.id === routine.clientId)
      setEditingItem(routine)
      setRoutineForm({
        clientId: routine.clientId,
        title: routine.title,
        description: routine.description || '',
        validFrom: routine.validFrom?.split('T')[0] || new Date().toISOString().split('T')[0],
        validUntil: routine.validUntil?.split('T')[0] || '',
        goal: routineUser?.trainingGoal || routine.goal || ''
      })
    } else {
      setEditingItem(null)
      setRoutineForm({
        clientId: '',
        title: '',
        description: '',
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        goal: ''
      })
    }
    setShowRoutineModal(true)
  }

  const saveRoutine = async (e) => {
    e.preventDefault()
    if (!routineForm.clientId || !routineForm.title) {
      toast.error('Cliente y título son requeridos', toastOptions)
      return
    }

    try {
      setSaving(true)
      if (editingItem) {
        await routinesService.updateRoutine(editingItem.id, routineForm)
        toast.success('Rutina actualizada', toastOptions)
      } else {
        const { data } = await routinesService.createRoutine(routineForm)
        toast.success('Rutina creada', toastOptions)
        // Auto-open the new routine
        fetchRoutineDetail(data.id)
      }
      setShowRoutineModal(false)
      fetchData()
    } catch (error) {
      console.error('Error saving routine:', error)
      toast.error('Error al guardar rutina', toastOptions)
    } finally {
      setSaving(false)
    }
  }

  const deleteRoutine = async (id) => {
    if (!confirm('¿Eliminar esta rutina y todas sus sesiones?')) return
    try {
      await routinesService.deleteRoutine(id)
      toast.success('Rutina eliminada', toastOptions)
      if (selectedRoutine?.id === id) {
        setSelectedRoutine(null)
      }
      fetchData()
    } catch (error) {
      toast.error('Error al eliminar', toastOptions)
    }
  }

  const duplicateRoutine = async (routineId, newClientId) => {
    try {
      setSaving(true)
      await routinesService.duplicateRoutine(routineId, newClientId)
      toast.success('Rutina duplicada', toastOptions)
      fetchData()
    } catch (error) {
      console.error('Error duplicating routine:', error)
      toast.error('Error al duplicar rutina', toastOptions)
    } finally {
      setSaving(false)
    }
  }

  // Session Modal Handlers
  const openSessionModal = (routineId, session = null) => {
    const currentSessions = selectedRoutine?.routineSessions?.length || 0
    
    if (session) {
      setEditingItem(session)
      setSessionForm({
        routineId: routineId,
        sessionNumber: session.sessionNumber,
        title: session.title || '',
        description: session.description || ''
      })
    } else {
      setEditingItem(null)
      setSessionForm({
        routineId: routineId,
        sessionNumber: currentSessions + 1,
        title: `Sesión ${currentSessions + 1}`,
        description: ''
      })
    }
    setShowSessionModal(true)
  }

  const saveSession = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      if (editingItem) {
        await routinesService.updateSession(editingItem.id, sessionForm)
        toast.success('Sesión actualizada', toastOptions)
      } else {
        await routinesService.createSession(sessionForm)
        toast.success('Sesión creada', toastOptions)
      }
      setShowSessionModal(false)
      fetchRoutineDetail(sessionForm.routineId)
    } catch (error) {
      console.error('Error saving session:', error)
      toast.error('Error al guardar sesión', toastOptions)
    } finally {
      setSaving(false)
    }
  }

  const deleteSession = async (sessionId) => {
    if (!confirm('¿Eliminar esta sesión y todos sus ejercicios?')) return
    try {
      await routinesService.deleteSession(sessionId)
      toast.success('Sesión eliminada', toastOptions)
      fetchRoutineDetail(selectedRoutine.id)
    } catch (error) {
      toast.error('Error al eliminar', toastOptions)
    }
  }

  // Exercise Modal Handlers
  const openExerciseModal = (sessionId, sessionExercise = null, boxNumber = null) => {
    const session = selectedRoutine?.routineSessions?.find(s => s.id === sessionId)
    const boxExercises = session?.sessionExercises?.filter(se => se.boxNumber === boxNumber) || []
    const currentExercises = boxExercises.length
    
    if (sessionExercise) {
      setEditingItem(sessionExercise)
      setExerciseForm({
        sessionId: sessionId,
        exerciseId: sessionExercise.exercises?.id || sessionExercise.exerciseId,
        boxId: sessionExercise.boxId || '',
        boxNumber: sessionExercise.boxNumber || '',
        exerciseOrder: sessionExercise.exerciseOrder,
        setsReps: sessionExercise.setsReps || '3x12',
        restTime: sessionExercise.restTime || '60s',
        repetitionTime: sessionExercise.repetitionTime || '',
        weightKg: sessionExercise.weightKg || '',
        microPause: sessionExercise.microPause || '',
        notes: sessionExercise.notes || ''
      })
    } else {
      const selectedBox = boxes.find(b => b.boxNumber === boxNumber)
      setEditingItem(null)
      setExerciseForm({
        sessionId: sessionId,
        exerciseId: '',
        boxId: selectedBox?.id || '',
        boxNumber: boxNumber || '',
        exerciseOrder: currentExercises + 1,
        setsReps: '3x12',
        restTime: '60s',
        repetitionTime: '',
        weightKg: '',
        microPause: '',
        notes: ''
      })
    }
    setShowExerciseModal(true)
  }

  const saveExerciseToSession = async (e) => {
    e.preventDefault()
    if (!exerciseForm.exerciseId) {
      toast.error('Selecciona un ejercicio', toastOptions)
      return
    }

    try {
      setSaving(true)
      if (editingItem) {
        await routinesService.updateSessionExercise(editingItem.id, exerciseForm)
        toast.success('Ejercicio actualizado', toastOptions)
      } else {
        await routinesService.addExerciseToSession(exerciseForm)
        toast.success('Ejercicio agregado', toastOptions)
      }
      setShowExerciseModal(false)
      fetchRoutineDetail(selectedRoutine.id)
    } catch (error) {
      console.error('Error saving exercise:', error)
      toast.error('Error al guardar ejercicio', toastOptions)
    } finally {
      setSaving(false)
    }
  }

  const removeExerciseFromSession = async (sessionExerciseId) => {
    if (!confirm('¿Quitar este ejercicio de la sesión?')) return
    try {
      await routinesService.removeExerciseFromSession(sessionExerciseId)
      toast.success('Ejercicio quitado', toastOptions)
      fetchRoutineDetail(selectedRoutine.id)
    } catch (error) {
      toast.error('Error al quitar', toastOptions)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getGoalLabel = (goal) => {
    const goals = {
      'weight_loss': 'Pérdida de peso',
      'perdida-peso': 'Pérdida de peso',
      'muscle_gain': 'Ganancia muscular',
      'aumento-masa-muscular': 'Ganancia muscular',
      'strength': 'Fuerza',
      'endurance': 'Resistencia',
      'mejora-resistencia': 'Resistencia',
      'flexibility': 'Flexibilidad',
      'general_fitness': 'Fitness general',
      'tonificacion': 'Tonificación'
    }
    return goals[goal] || goal || 'No especificado'
  }

  const handleClientChange = (clientId) => {
    const selectedClient = users.find(u => u.id === clientId)
    const clientGoal = selectedClient?.trainingGoal || ''
    setRoutineForm({ 
      ...routineForm, 
      clientId, 
      goal: clientGoal 
    })
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
          <h1 className="text-xl font-semibold text-text-primary">Rutinas de Entrenamiento</h1>
          <p className="text-sm text-text-secondary mt-1">
            {routines.length} rutinas • {routines.filter(r => r.status === 'active').length} activas
          </p>
        </div>
        <button
          onClick={() => openRoutineModal()}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="h-4 w-4" />
          Nueva Rutina
        </button>
      </div>

      <div className="flex gap-6">
        {/* Routines List */}
        <div className={`${selectedRoutine ? 'w-1/3' : 'w-full'} space-y-4 transition-all`}>
          {/* Filters */}
          <div className="flex flex-col gap-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="Buscar rutina o cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input pl-9"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-select flex-1"
              >
                <option value="">Todos los estados</option>
                <option value="active">Activa</option>
                <option value="completed">Completada</option>
                <option value="expired">Expirada</option>
                <option value="paused">Pausada</option>
              </select>
            </div>
          </div>

          {/* Routines Grid/List */}
          <div className="space-y-3">
            {filteredRoutines.map(routine => (
              <div 
                key={routine.id} 
                onClick={() => fetchRoutineDetail(routine.id)}
                className={`card cursor-pointer transition-all hover:border-brand/50 ${
                  selectedRoutine?.id === routine.id ? 'border-brand ring-1 ring-brand/20' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text-primary truncate">{routine.title}</h3>
                    <p className="text-sm text-text-secondary">
                      {routine.users?.firstName} {routine.users?.lastName}
                    </p>
                  </div>
                  {getStatusBadge(routine.status)}
                </div>
                
                <div className="flex items-center gap-4 text-xs text-text-tertiary">
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {formatDate(routine.validFrom)}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClipboardDocumentListIcon className="h-3.5 w-3.5" />
                    {routine.routineSessions?.length || 0} sesiones
                  </span>
                </div>
              </div>
            ))}

            {filteredRoutines.length === 0 && (
              <div className="text-center py-12 card">
                <ClipboardDocumentListIcon className="h-12 w-12 text-text-tertiary mx-auto mb-3" />
                <p className="text-text-secondary">No hay rutinas</p>
                <button
                  onClick={() => openRoutineModal()}
                  className="btn-primary mt-4"
                >
                  Crear primera rutina
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Routine Detail Panel */}
        {selectedRoutine && (
          <div className="flex-1 card">
            {loadingDetail ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Detail Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-semibold text-text-primary">{selectedRoutine.title}</h2>
                      {getStatusBadge(selectedRoutine.status)}
                    </div>
                    <p className="text-sm text-text-secondary">
                      <UserIcon className="h-4 w-4 inline mr-1" />
                      {selectedRoutine.users?.firstName} {selectedRoutine.users?.lastName}
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      {formatDate(selectedRoutine.validFrom)} - {formatDate(selectedRoutine.validUntil)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openRoutineModal(selectedRoutine)}
                      className="p-2 text-text-tertiary hover:text-brand hover:bg-brand/10 rounded transition-colors"
                      title="Editar rutina"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteRoutine(selectedRoutine.id)}
                      className="p-2 text-text-tertiary hover:text-error hover:bg-error/10 rounded transition-colors"
                      title="Eliminar rutina"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSelectedRoutine(null)}
                      className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-surface rounded transition-colors"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {selectedRoutine.description && (
                  <p className="text-sm text-text-secondary">{selectedRoutine.description}</p>
                )}

                {/* Sessions */}
                <div className="border-t border-border-default pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-text-primary">Sesiones</h3>
                    <button
                      onClick={() => openSessionModal(selectedRoutine.id)}
                      className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Agregar Sesión
                    </button>
                  </div>

                  <div className="space-y-3">
                    {selectedRoutine.routineSessions?.map(session => (
                      <div key={session.id} className="border border-border-default rounded-lg overflow-hidden">
                        {/* Session Header */}
                        <div 
                          className="flex items-center justify-between p-3 bg-bg-surface/50 cursor-pointer"
                          onClick={() => toggleSession(session.id)}
                        >
                          <div className="flex items-center gap-3">
                            {expandedSessions[session.id] ? (
                              <ChevronDownIcon className="h-4 w-4 text-text-tertiary" />
                            ) : (
                              <ChevronRightIcon className="h-4 w-4 text-text-tertiary" />
                            )}
                            <div className="w-8 h-8 bg-brand/10 rounded-full flex items-center justify-center">
                              <span className="text-brand font-bold text-sm">{session.sessionNumber}</span>
                            </div>
                            <div>
                              <p className="font-medium text-text-primary text-sm">{session.title}</p>
                              <p className="text-xs text-text-tertiary">
                                {session.sessionExercises?.length || 0} ejercicios
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              session.status === 'completed' ? 'bg-green-100 text-green-700' :
                              session.status === 'unlocked' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {session.status === 'completed' ? 'Completada' :
                               session.status === 'unlocked' ? 'Desbloqueada' : 'Bloqueada'}
                            </span>
                            <button
                              onClick={() => openSessionModal(selectedRoutine.id, session)}
                              className="p-1 text-text-tertiary hover:text-brand"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => deleteSession(session.id)}
                              className="p-1 text-text-tertiary hover:text-error"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Session Content - Exercises by Station */}
                        {expandedSessions[session.id] && (
                          <div className="border-t border-border-default">
                            {/* 5 Stations Grid */}
                            <div className="grid grid-cols-5 gap-px bg-border-default">
                              {[1, 2, 3, 4, 5].map(boxNum => {
                                const boxExercises = session.sessionExercises
                                  ?.filter(se => se.boxNumber === boxNum)
                                  ?.sort((a, b) => a.exerciseOrder - b.exerciseOrder) || []
                                
                                return (
                                  <div key={boxNum} className="bg-bg-secondary min-h-[150px]">
                                    {/* Station Header */}
                                    <div className="bg-brand/10 px-2 py-1.5 text-center border-b border-border-default">
                                      <span className="text-xs font-semibold text-brand">Estación {boxNum}</span>
                                      <span className="text-xs text-text-tertiary ml-1">({boxExercises.length})</span>
                                    </div>
                                    
                                    {/* Exercises in Station */}
                                    <div className="p-2 space-y-1.5">
                                      {boxExercises.map((se, idx) => (
                                        <div 
                                          key={se.id} 
                                          className="bg-bg-surface p-2 rounded text-xs group hover:bg-bg-surface/70"
                                        >
                                          <div className="flex items-start justify-between gap-1">
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium text-text-primary truncate" title={se.exercises?.name}>
                                                {idx + 1}. {se.exercises?.name}
                                              </p>
                                              <p className="text-text-tertiary">
                                                {se.setsReps}
                                                {se.weightKg && ` • ${se.weightKg}kg`}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button
                                                onClick={() => openExerciseModal(session.id, se, boxNum)}
                                                className="p-0.5 text-text-tertiary hover:text-brand"
                                              >
                                                <PencilIcon className="h-3 w-3" />
                                              </button>
                                              <button
                                                onClick={() => removeExerciseFromSession(se.id)}
                                                className="p-0.5 text-text-tertiary hover:text-error"
                                              >
                                                <TrashIcon className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                      
                                      {/* Add exercise to station */}
                                      <button
                                        onClick={() => openExerciseModal(session.id, null, boxNum)}
                                        className="w-full py-1.5 border border-dashed border-border-default rounded text-xs text-text-tertiary hover:text-brand hover:border-brand transition-colors flex items-center justify-center gap-1"
                                      >
                                        <PlusIcon className="h-3 w-3" />
                                        Agregar
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            
                            {/* Exercises without station (legacy/unassigned) */}
                            {session.sessionExercises?.filter(se => !se.boxNumber).length > 0 && (
                              <div className="p-3 bg-yellow-50 border-t border-yellow-200">
                                <p className="text-xs font-medium text-yellow-700 mb-2">Ejercicios sin estación asignada:</p>
                                <div className="flex flex-wrap gap-2">
                                  {session.sessionExercises?.filter(se => !se.boxNumber).sort((a, b) => a.exerciseOrder - b.exerciseOrder).map(se => (
                                    <div key={se.id} className="bg-white px-2 py-1 rounded text-xs flex items-center gap-2 border border-yellow-200">
                                      <span>{se.exercises?.name}</span>
                                      <button
                                        onClick={() => openExerciseModal(session.id, se)}
                                        className="text-yellow-600 hover:text-brand"
                                      >
                                        <PencilIcon className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {(!selectedRoutine.routineSessions || selectedRoutine.routineSessions.length === 0) && (
                      <div className="text-center py-8 border border-dashed border-border-default rounded-lg">
                        <p className="text-sm text-text-tertiary mb-3">No hay sesiones</p>
                        <button
                          onClick={() => openSessionModal(selectedRoutine.id)}
                          className="btn-secondary text-sm"
                        >
                          Agregar primera sesión
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Routine Modal */}
      {showRoutineModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowRoutineModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-bg-secondary rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between p-4 border-b border-border-default">
                <h2 className="text-lg font-semibold text-text-primary">
                  {editingItem ? 'Editar Rutina' : 'Nueva Rutina'}
                </h2>
                <button onClick={() => setShowRoutineModal(false)} className="p-1 hover:bg-bg-surface rounded">
                  <XMarkIcon className="h-5 w-5 text-text-secondary" />
                </button>
              </div>
              
              <form onSubmit={saveRoutine} className="p-4 space-y-4">
                <div>
                  <label className="form-label">Cliente *</label>
                  <select
                    value={routineForm.clientId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="form-select"
                    required
                    disabled={!!editingItem}
                  >
                    <option value="">Seleccionar cliente...</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                  </select>
                  {editingItem && (
                    <p className="text-xs text-text-tertiary mt-1">No se puede cambiar el cliente de una rutina existente</p>
                  )}
                </div>

                {/* Goal - Read-only, from user's training goal */}
                {routineForm.clientId && (
                  <div>
                    <label className="form-label">Objetivo del Cliente</label>
                    <div className="p-3 bg-bg-surface rounded-lg border border-border-default">
                      <p className="text-sm font-medium text-text-primary">
                        {getGoalLabel(routineForm.goal)}
                      </p>
                      <p className="text-xs text-text-tertiary mt-1">
                        Basado en el objetivo de entrenamiento del cliente
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="form-label">Título *</label>
                  <input
                    type="text"
                    value={routineForm.title}
                    onChange={(e) => setRoutineForm({ ...routineForm, title: e.target.value })}
                    className="form-input"
                    placeholder="Ej: Rutina de Fuerza - Semana 1-4"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Descripción</label>
                  <textarea
                    value={routineForm.description}
                    onChange={(e) => setRoutineForm({ ...routineForm, description: e.target.value })}
                    className="form-textarea"
                    rows={2}
                    placeholder="Objetivos y notas de la rutina..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Fecha Inicio</label>
                    <input
                      type="date"
                      value={routineForm.validFrom}
                      onChange={(e) => setRoutineForm({ ...routineForm, validFrom: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Fecha Fin</label>
                    <input
                      type="date"
                      value={routineForm.validUntil}
                      onChange={(e) => setRoutineForm({ ...routineForm, validUntil: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                  <button type="button" onClick={() => setShowRoutineModal(false)} className="btn-secondary">
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

      {/* Session Modal */}
      {showSessionModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowSessionModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-bg-secondary rounded-lg shadow-xl max-w-md w-full animate-fade-in">
              <div className="flex items-center justify-between p-4 border-b border-border-default">
                <h2 className="text-lg font-semibold text-text-primary">
                  {editingItem ? 'Editar Sesión' : 'Nueva Sesión'}
                </h2>
                <button onClick={() => setShowSessionModal(false)} className="p-1 hover:bg-bg-surface rounded">
                  <XMarkIcon className="h-5 w-5 text-text-secondary" />
                </button>
              </div>
              
              <form onSubmit={saveSession} className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Número de Sesión</label>
                    <input
                      type="number"
                      value={sessionForm.sessionNumber}
                      onChange={(e) => setSessionForm({ ...sessionForm, sessionNumber: parseInt(e.target.value) })}
                      className="form-input"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Nombre</label>
                    <input
                      type="text"
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                      className="form-input"
                      placeholder="Ej: Día de Pierna"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Descripción</label>
                  <textarea
                    value={sessionForm.description}
                    onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
                    className="form-textarea"
                    rows={2}
                    placeholder="Notas para esta sesión..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                  <button type="button" onClick={() => setShowSessionModal(false)} className="btn-secondary">
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

      {/* Exercise Modal */}
      {showExerciseModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowExerciseModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-bg-secondary rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fade-in">
              <div className="flex items-center justify-between p-4 border-b border-border-default">
                <h2 className="text-lg font-semibold text-text-primary">
                  {editingItem ? 'Editar Ejercicio' : 'Agregar Ejercicio'}
                  {exerciseForm.boxNumber && (
                    <span className="ml-2 text-sm font-normal text-brand">
                      - Estación {exerciseForm.boxNumber}
                    </span>
                  )}
                </h2>
                <button onClick={() => setShowExerciseModal(false)} className="p-1 hover:bg-bg-surface rounded">
                  <XMarkIcon className="h-5 w-5 text-text-secondary" />
                </button>
              </div>
              
              <form onSubmit={saveExerciseToSession} className="p-4 space-y-4">
                {/* Station Selection */}
                <div>
                  <label className="form-label">Estación *</label>
                  <select
                    value={exerciseForm.boxNumber}
                    onChange={(e) => {
                      const boxNum = parseInt(e.target.value)
                      const selectedBox = boxes.find(b => b.boxNumber === boxNum)
                      setExerciseForm({ 
                        ...exerciseForm, 
                        boxNumber: boxNum, 
                        boxId: selectedBox?.id || '' 
                      })
                    }}
                    className="form-select"
                    required
                  >
                    <option value="">Seleccionar estación...</option>
                    {[1, 2, 3, 4, 5].map(num => (
                      <option key={num} value={num}>Estación {num}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Ejercicio *</label>
                  <select
                    value={exerciseForm.exerciseId}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, exerciseId: e.target.value })}
                    className="form-select"
                    required
                  >
                    <option value="">Seleccionar ejercicio...</option>
                    {bodyZones.map(zone => (
                      <optgroup key={zone.id} label={zone.name}>
                        {exercises
                          .filter(e => {
                            const cat = categories.find(c => c.id === e.categoryId)
                            return cat?.bodyZoneId === zone.id
                          })
                          .map(ex => (
                            <option key={ex.id} value={ex.id}>{ex.name}</option>
                          ))
                        }
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">Series x Reps *</label>
                    <input
                      type="text"
                      value={exerciseForm.setsReps}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, setsReps: e.target.value })}
                      className="form-input"
                      placeholder="3x12"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Descanso</label>
                    <input
                      type="text"
                      value={exerciseForm.restTime}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, restTime: e.target.value })}
                      className="form-input"
                      placeholder="60s"
                    />
                  </div>
                  <div>
                    <label className="form-label">T. Rep (seg)</label>
                    <input
                      type="number"
                      value={exerciseForm.repetitionTime}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, repetitionTime: e.target.value })}
                      className="form-input"
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">Peso (kg)</label>
                    <input
                      type="number"
                      value={exerciseForm.weightKg}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, weightKg: e.target.value })}
                      className="form-input"
                      placeholder="Opcional"
                      step="0.5"
                    />
                  </div>
                  <div>
                    <label className="form-label">Micro Pausa</label>
                    <input
                      type="number"
                      value={exerciseForm.microPause}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, microPause: e.target.value })}
                      className="form-input"
                      placeholder="seg"
                    />
                  </div>
                  <div>
                    <label className="form-label">Orden</label>
                    <input
                      type="number"
                      value={exerciseForm.exerciseOrder}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, exerciseOrder: parseInt(e.target.value) })}
                      className="form-input"
                      min="1"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Notas</label>
                  <textarea
                    value={exerciseForm.notes}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, notes: e.target.value })}
                    className="form-textarea"
                    rows={2}
                    placeholder="Instrucciones específicas..."
                  />
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
    </div>
  )
}

