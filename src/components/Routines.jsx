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
  DocumentDuplicateIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import * as Sentry from '@sentry/react'
import routinesService from '../services/routinesService'
import exercisesService from '../services/exercisesService'
import { generateRoutineSessions } from '../services/routineGenerationService'
import { supabase, toCamelCase } from '../lib/supabase'
import { BLOQUE_SEG, comoTexto, duracionEstacionSeg, duracionSeg, esPorTiempo, mmss } from '../lib/formatos'
import toast, { Toaster } from 'react-hot-toast'
import { toastOptions } from '../lib/themeStyles'
import SelectorEjercicio from './SelectorEjercicio'
import SelectorFormato from './SelectorFormato'
import PanelSustitutos from './PanelSustitutos'
import PesoSugerido from './PesoSugerido'
import Sidecart from './Sidecart'

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
    goal: '',
    arquetipoId: ''
  })
  const [arquetipos, setArquetipos] = useState([])

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
    notes: '',
    isCooldown: false,
    formato: 'Series',
    rondas: null,
    trabajoSeg: null,
    descansoSeg: null
  })

  // Expanded sessions
  const [expandedSessions, setExpandedSessions] = useState({})
  const [generating, setGenerating] = useState(false)
  const [sustituyendo, setSustituyendo] = useState(null)
  // How long a member actually stays in a box, read from the queue rather than assumed: it is
  // what decides whether a Tabata fits, and a wrong number here is worse than no warning.
  const [turnoSeg, setTurnoSeg] = useState(0)

  useEffect(() => {
    fetchData()
    supabase
      .from('line_box_status')
      .select('entered_at, advances_at')
      .not('advances_at', 'is', null)
      .limit(20)
      .then(({ data }) => {
        const turnos = (data || [])
          .map((r) => Math.round((new Date(r.advances_at) - new Date(r.entered_at)) / 1000))
          .filter((n) => n > 0)
        if (turnos.length) setTurnoSeg(turnos.sort((a, b) => a - b)[Math.floor(turnos.length / 2)])
      })
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
      // Los arquetipos son filas, no una lista en el código: el gym los renombra.
      supabase
        .from('arquetipos')
        .select('id, nombre, descripcion')
        .eq('is_active', true)
        .order('orden')
        .then(({ data }) => setArquetipos(data || []))
    } catch (error) {
      Sentry.captureException(error, { extra: { context: 'Error fetching data:' } })
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
      Sentry.captureException(error, { extra: { context: 'Error fetching routine detail:' } })
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
        // Partir del arquetipo es copiar sus sesiones escritas a mano: quedan como manuales, así
        // que el coach las ajusta y el motor completa el resto desde ahí.
        if (routineForm.arquetipoId) {
          const { data: copiadas, error: errCopia } = await supabase.rpc(
            'copiar_plantilla_de_arquetipo',
            { p_routine_id: data.id, p_arquetipo_id: Number(routineForm.arquetipoId) }
          )
          if (errCopia) {
            toast.error(errCopia.message, toastOptions)
          } else {
            toast.success(`Rutina creada con ${copiadas} ${copiadas === 1 ? 'sesión' : 'sesiones'} del arquetipo`, toastOptions)
          }
        } else {
          toast.success('Rutina creada', toastOptions)
        }
        // Auto-open the new routine
        fetchRoutineDetail(data.id)
      }
      setShowRoutineModal(false)
      fetchData()
    } catch (error) {
      Sentry.captureException(error, { extra: { context: 'Error saving routine:' } })
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
      Sentry.captureException(error, { extra: { context: 'Error duplicating routine:' } })
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
      Sentry.captureException(error, { extra: { context: 'Error saving session:' } })
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
  const openExerciseModal = (sessionId, sessionExercise = null, boxNumber = null, isCooldown = false) => {
    const session = selectedRoutine?.routineSessions?.find(s => s.id === sessionId)
    // exercise_order is UNIQUE per session, not per station. Counting only the exercises
    // already in this box proposed 1 for every empty station, so adding a second station to a
    // session always collided with the first one and the save failed with a 409 — nobody could
    // build a session past one station. Take the next free number across the whole session.
    const yaEnSesion = session?.sessionExercises || []
    const siguienteOrden = yaEnSesion.reduce((max, se) => Math.max(max, se.exerciseOrder || 0), 0) + 1

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
        notes: sessionExercise.notes || '',
        isCooldown: sessionExercise.isCooldown || false,
        formato: sessionExercise.formato || 'Series',
        rondas: sessionExercise.rondas ?? null,
        trabajoSeg: sessionExercise.trabajoSeg ?? null,
        descansoSeg: sessionExercise.descansoSeg ?? null
      })
    } else {
      const selectedBox = boxes.find(b => b.boxNumber === boxNumber)
      setEditingItem(null)
      setExerciseForm({
        sessionId: sessionId,
        exerciseId: '',
        boxId: isCooldown ? '' : (selectedBox?.id || ''),
        boxNumber: isCooldown ? null : (boxNumber || ''),
        exerciseOrder: siguienteOrden,
        setsReps: '3x12',
        restTime: '60s',
        repetitionTime: '',
        weightKg: '',
        microPause: '',
        notes: '',
        isCooldown: isCooldown,
        formato: 'Series',
        rondas: null,
        trabajoSeg: null,
        descansoSeg: null
      })
    }
    setShowExerciseModal(true)
  }

  // Lo que ya ocupan las OTRAS filas de esta estación. El socio hace el circuito entero antes
  // de avanzar de box, así que el tope de seis minutos es de la estación, no de la fila: sin
  // esto, tres filas de dos minutos pasaban el control una por una y el box corría seis de más.
  const usadoEnEstacion = (() => {
    const sesion = selectedRoutine?.routineSessions?.find((x) => x.id === exerciseForm.sessionId)
    return duracionEstacionSeg(
      (sesion?.sessionExercises || []).filter(
        (se) =>
          se.id !== editingItem?.id &&
          Boolean(se.isCooldown) === Boolean(exerciseForm.isCooldown) &&
          (exerciseForm.isCooldown || se.boxNumber === exerciseForm.boxNumber)
      )
    )
  })()

  const saveExerciseToSession = async (e) => {
    e.preventDefault()
    if (!exerciseForm.exerciseId) {
      toast.error('Selecciona un ejercicio', toastOptions)
      return
    }

    // El tope se corta acá y no sólo en el aviso del selector: el aviso lo puede pasar por alto
    // quien está cargando rápido, y lo que llega a la tabla es lo que después corre en el box.
    const totalEstacion = usadoEnEstacion + (esPorTiempo(exerciseForm.formato) ? duracionSeg(exerciseForm) : 0)
    if (totalEstacion > BLOQUE_SEG) {
      toast.error(
        `La estación queda en ${mmss(totalEstacion)} y el tope es ${mmss(BLOQUE_SEG)}. ` +
          'Bajá rondas o tiempo antes de guardar.',
        toastOptions
      )
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
      Sentry.captureException(error, { extra: { context: 'Error saving exercise:' } })
      console.error('Error saving exercise:', error)
      // The real message, always. "Error al guardar ejercicio" is what hid a unique-constraint
      // collision on exercise_order behind a shrug for however long it has been broken.
      toast.error(error?.message || String(error), toastOptions)
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

  const handleGenerateSessions = async () => {
    if (!selectedRoutine) return
    // The engine builds from whatever the coach wrote by hand; it only needs one to start.
    // Con una alcanza. El motor construye a partir de las que escribió el coach, sean una o seis.
    const aMano = selectedRoutine.routineSessions || []
    if (aMano.length === 0) {
      toast.error('Cargá la Sesión 1 antes de generar — con una alcanza, el motor construye a partir de las que armás vos', toastOptions)
      return
    }
    if (!confirm('El motor va a completar el mes usando las sesiones que cargaste a mano como base.\n\nCada sesión generada rota el ejercicio de cada estación por otro del mismo patrón de movimiento, que la estación pueda correr y que el socio pueda hacer.\n\nLo que ya estaba generado se reemplaza; lo que cargaste a mano no se toca.\n\n¿Continuar?')) return
    try {
      setGenerating(true)
      const { generadas } = await generateRoutineSessions(selectedRoutine.id)
      toast.success(`${generadas} sesiones generadas`, toastOptions)
      fetchRoutineDetail(selectedRoutine.id)
      fetchData()
    } catch (error) {
      Sentry.captureException(error, { extra: { context: 'Error generating sessions:' } })
      console.error('Error generating sessions:', error)
      toast.error(error?.message || 'Error al generar sesiones', toastOptions)
    } finally {
      setGenerating(false)
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
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-text-primary">Sesiones</h3>
                      {selectedRoutine.generationStatus === 'completed' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Auto-generada</span>
                      )}
                      {selectedRoutine.generationStatus === 'generating' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                          <span className="w-2 h-2 border border-blue-500 border-t-transparent rounded-full animate-spin inline-block" />
                          Generando...
                        </span>
                      )}
                      {selectedRoutine.generationStatus === 'failed' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Error en generación</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedRoutine.generationStatus !== 'generating' && (
                        <button
                          onClick={handleGenerateSessions}
                          disabled={generating}
                          className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 disabled:opacity-50"
                          title="Completa el resto del mes a partir de las sesiones que cargaste a mano"
                        >
                          {generating ? (
                            <>
                              <span className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                              Generando...
                            </>
                          ) : (
                            <>
                              <PlayIcon className="h-3.5 w-3.5" />
                              {selectedRoutine.generationStatus === 'completed' ? 'Regenerar' : 'Generar Sesiones'}
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => openSessionModal(selectedRoutine.id)}
                        className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Agregar Sesión
                      </button>
                    </div>
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
                                
                                // Lo que ocupa la estación de los seis minutos del bloque. Estaba
                                // sólo adentro del modal de cada ejercicio: para saber si el box
                                // iba en 2:00 o en 6:00 había que abrir las filas de a una.
                                const ocupado = duracionEstacionSeg(boxExercises)
                                const pasado = ocupado > BLOQUE_SEG

                                return (
                                  <div key={boxNum} className="bg-bg-secondary min-h-[150px]">
                                    {/* Station Header */}
                                    <div className="bg-brand/10 px-2 py-1.5 border-b border-border-default">
                                      <div className="flex items-baseline justify-center gap-1.5">
                                        <span className="text-xs font-semibold text-brand">Estación {boxNum}</span>
                                        <span className="text-xs text-text-tertiary">({boxExercises.length})</span>
                                      </div>
                                      {ocupado > 0 && (
                                        <>
                                          <div className="mt-1 h-1 rounded-full bg-brand/20 overflow-hidden">
                                            <div
                                              className={`h-full rounded-full ${pasado ? 'bg-error' : 'bg-brand'}`}
                                              style={{ width: `${Math.min(100, (ocupado / BLOQUE_SEG) * 100)}%` }}
                                            />
                                          </div>
                                          <p
                                            className={`mt-0.5 text-center text-[10px] tabular-nums ${pasado ? 'text-error font-semibold' : 'text-text-tertiary'}`}
                                            title={pasado ? 'Se pasa del bloque de 6:00 que dura el turno en el box' : 'Tiempo con reloj de esta estación'}
                                          >
                                            {mmss(ocupado)} / {mmss(BLOQUE_SEG)}
                                          </p>
                                        </>
                                      )}
                                    </div>
                                    
                                    {/* Exercises in Station */}
                                    <div className="p-2 space-y-1.5">
                                      {boxExercises.map((se, idx) => (
                                        <div 
                                          key={se.id} 
                                          className="bg-bg-surface p-2 rounded text-xs group hover:bg-bg-surface/70"
                                        >
                                          {/* Apilado, no en dos columnas: la estación mide ~200px
                                              y con el nombre y los botones peleando por el mismo
                                              renglón los ejercicios quedaban en "1. Sen…". El
                                              nombre se lleva el ancho completo y usa dos líneas. */}
                                          <div className="flex flex-col gap-1">
                                            <div className="min-w-0">
                                              <p className="font-medium text-text-primary line-clamp-2" title={se.exercises?.name}>
                                                {idx + 1}. {se.exercises?.name}
                                              </p>
                                              <p className="text-text-tertiary truncate">
                                                {se.setsReps}
                                                {se.weightKg && ` • ${se.weightKg}kg`}
                                              </p>
                                              {/* Sin esto un Tabata y unas series sueltas se
                                                  veían igual en la grilla. */}
                                              {esPorTiempo(se.formato) && (
                                                <p className="mt-1 inline-flex items-center whitespace-nowrap rounded bg-brand/10 px-1.5 py-px text-[10px] font-medium text-brand">
                                                  {comoTexto(se.formato, se)} · {mmss(duracionSeg(se))}
                                                </p>
                                              )}
                                            </div>
                                            <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                              <button
                                                onClick={() => setSustituyendo({ fila: se, estacion: boxNum, boxId: se.box_id })}
                                                className="p-0.5 text-text-tertiary hover:text-brand"
                                                title="Cambiar por otro del mismo patrón"
                                              >
                                                <ArrowPathIcon className="h-3 w-3" />
                                              </button>
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
                            
                            {/* Exercises without station (legacy/unassigned, not cooldown) */}
                            {session.sessionExercises?.filter(se => !se.boxNumber && !se.isCooldown).length > 0 && (
                              <div className="p-3 bg-yellow-50 border-t border-yellow-200">
                                <p className="text-xs font-medium text-yellow-700 mb-2">Ejercicios sin estación asignada:</p>
                                <div className="flex flex-wrap gap-2">
                                  {session.sessionExercises?.filter(se => !se.boxNumber && !se.isCooldown).sort((a, b) => a.exerciseOrder - b.exerciseOrder).map(se => (
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

                            {/* Cooldown Section */}
                            {(() => {
                              const cooldownExercises = session.sessionExercises
                                ?.filter(se => se.isCooldown)
                                ?.sort((a, b) => a.exerciseOrder - b.exerciseOrder) || []
                              return (
                                <div className="border-t border-blue-200 bg-gradient-to-r from-blue-50 to-sky-50">
                                  <div className="flex items-center justify-between px-3 py-2 border-b border-blue-200">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                                      <span className="text-xs font-semibold text-blue-700">Cooldown</span>
                                      <span className="text-xs text-blue-400">({cooldownExercises.length} ejercicios)</span>
                                    </div>
                                    <button
                                      onClick={() => openExerciseModal(session.id, null, null, true)}
                                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors"
                                    >
                                      <PlusIcon className="h-3 w-3" />
                                      Agregar
                                    </button>
                                  </div>
                                  <div className="p-3">
                                    {cooldownExercises.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {cooldownExercises.map((se, idx) => (
                                          <div
                                            key={se.id}
                                            className="bg-white border border-blue-200 rounded px-2 py-1.5 text-xs group flex items-center gap-2"
                                          >
                                            <span className="text-blue-400 font-medium">{idx + 1}.</span>
                                            <div>
                                              <p className="font-medium text-text-primary">{se.exercises?.name}</p>
                                              <p className="text-text-tertiary">{se.setsReps}{se.restTime && ` • ${se.restTime}`}</p>
                                            </div>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button
                                                onClick={() => openExerciseModal(session.id, se, null, true)}
                                                className="p-0.5 text-blue-400 hover:text-blue-600"
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
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-blue-300 italic">Sin ejercicios de cooldown</p>
                                    )}
                                  </div>
                                </div>
                              )
                            })()}
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
      <Sidecart
        isOpen={showRoutineModal}
        onClose={() => setShowRoutineModal(false)}
        title={editingItem ? 'Editar rutina' : 'Nueva rutina'}
        subtitle={'Para quién es y desde cuándo corre'}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowRoutineModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" form="form-rutina" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        }
      >
        <form id="form-rutina" onSubmit={saveRoutine} className="space-y-4">
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

                {!editingItem && arquetipos.length > 0 && (
                  <div>
                    <label className="form-label">Partir de un arquetipo</label>
                    <select
                      value={routineForm.arquetipoId}
                      onChange={(e) => setRoutineForm({ ...routineForm, arquetipoId: e.target.value })}
                      className="form-select"
                    >
                      <option value="">Empezar de cero</option>
                      {arquetipos.map((a) => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                    <p className="text-xs text-text-tertiary mt-1">
                      {arquetipos.find((a) => String(a.id) === String(routineForm.arquetipoId))
                        ?.descripcion ||
                        'Copia las sesiones ya escritas del arquetipo para no empezar con la hoja en blanco. Después las ajustás y el motor completa el mes.'}
                    </p>
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
        </form>
      </Sidecart>

      {/* Session Modal */}
      <Sidecart
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        title={editingItem ? 'Editar sesión' : 'Nueva sesión'}
        subtitle={'Una sesión es un día de la rutina'}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowSessionModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" form="form-sesion" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        }
      >
        <form id="form-sesion" onSubmit={saveSession} className="space-y-4">
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
        </form>
      </Sidecart>

      {/* Substitution panel */}
      <Sidecart
        isOpen={Boolean(sustituyendo)}
        onClose={() => setSustituyendo(null)}
        title="Cambiar el ejercicio"
        subtitle={
          sustituyendo
            ? `Estación ${sustituyendo.estacion} · en lugar de ${sustituyendo.fila.exercises?.name ?? ''}`
            : undefined
        }
        size="lg"
      >
        {sustituyendo && (
          <PanelSustitutos
            filaId={sustituyendo.fila.id}
            ejercicioActual={sustituyendo.fila.exercises}
            estacion={sustituyendo.estacion}
            boxId={sustituyendo.boxId}
            onSustituido={() => {
              setSustituyendo(null)
              toast.success('Ejercicio cambiado', toastOptions)
              fetchRoutineDetail(selectedRoutine.id)
            }}
          />
        )}
      </Sidecart>

      {/*
        Sidecart, no modal. Lo que va acá es una lista de ejercicios con miniaturas y filtros, y
        un pop-up centrado la apretaba en una columna de 512px con el resto de la pantalla
        vacía al lado.
      */}
      <Sidecart
        isOpen={showExerciseModal}
        onClose={() => setShowExerciseModal(false)}
        title={editingItem ? 'Editar ejercicio' : 'Agregar ejercicio'}
        subtitle={
          exerciseForm.isCooldown
            ? 'Cooldown — no va en una estación'
            : exerciseForm.boxNumber
              ? `Estación ${exerciseForm.boxNumber}`
              : 'Elegí la estación para ver qué se puede hacer ahí'
        }
        size="xl"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowExerciseModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button
              type="submit"
              form="form-ejercicio-sesion"
              disabled={saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        }
      >
              <form id="form-ejercicio-sesion" onSubmit={saveExerciseToSession} className="space-y-4">
                {/* Station Selection (hidden for cooldown exercises) */}
                {exerciseForm.isCooldown ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                    <span className="text-sm text-blue-700 font-medium">Ejercicio de Cooldown</span>
                  </div>
                ) : (
                  <div>
                    <label className="form-label">Estación *</label>
                    {/*
                      Las estaciones son las que el local tiene cargadas, no del uno al cinco.
                      Una línea puede ser de tres o de siete, y el número se repite entre líneas:
                      lo que se elige es el box, y el número queda para nombrarlo.
                    */}
                    <select
                      value={exerciseForm.boxId}
                      onChange={(e) => {
                        const box = boxes.find(b => String(b.id) === e.target.value)
                        setExerciseForm({
                          ...exerciseForm,
                          boxId: box?.id || '',
                          boxNumber: box?.linePosition ?? box?.boxNumber ?? ''
                        })
                      }}
                      className="form-select"
                      required
                    >
                      <option value="">Seleccionar estación...</option>
                      {boxes.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.productionLines?.name ? `${b.productionLines.name} · ` : ''}
                          {b.name || `Estación ${b.linePosition ?? b.boxNumber}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="form-label">Ejercicio *</label>
                  {/*
                    Was a <select> grouped by body zone. That taxonomy only covers the thirteen
                    demo rows — the gym's 296 classified exercises carry facets instead — so the
                    dropdown listed almost none of the catalog, and picking a station above it
                    filtered nothing, which let an exercise land in a box without the equipment
                    it needs. The station now drives the list.
                  */}
                  <SelectorEjercicio
                    estacion={exerciseForm.isCooldown ? null : exerciseForm.boxNumber}
                    boxId={exerciseForm.isCooldown ? null : exerciseForm.boxId}
                    esperaEstacion={!exerciseForm.isCooldown}
                    value={exerciseForm.exerciseId}
                    onChange={(id) => setExerciseForm({ ...exerciseForm, exerciseId: id })}
                  />
                </div>

                <div>
                  <label className="form-label">Cómo se mide el trabajo</label>
                  <SelectorFormato
                    valor={{
                      formato: exerciseForm.formato,
                      rondas: exerciseForm.rondas,
                      trabajoSeg: exerciseForm.trabajoSeg,
                      descansoSeg: exerciseForm.descansoSeg,
                    }}
                    onChange={(v) => setExerciseForm({ ...exerciseForm, ...v })}
                    turnoSeg={turnoSeg}
                    usadoSeg={usadoEnEstacion}
                  />
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

                {/* Full width: the sentence wraps to four words a line inside a third of the row. */}
                <PesoSugerido
                  clientId={selectedRoutine?.clientId}
                  exerciseId={exerciseForm.exerciseId}
                  valorActual={exerciseForm.weightKg}
                  onUsar={(kg) => setExerciseForm({ ...exerciseForm, weightKg: kg })}
                />


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

              </form>
      </Sidecart>
    </div>
  )
}

