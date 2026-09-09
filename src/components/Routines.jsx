import { useState, useEffect } from 'react'
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
  PlayIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  Bars2Icon
} from '@heroicons/react/24/outline'
import * as Sentry from '@sentry/react'
import routinesService from '../services/routinesService'
import exercisesService from '../services/exercisesService'
import { generateRoutineSessions } from '../services/routineGenerationService'
import { supabase, toCamelCase } from '../lib/supabase'
import { BLOQUE_SEG, CUPO_POR_FORMATO, REPS_POR_FORMATO, comoTexto, duracionEstacionSeg, duracionSeg, esPorTiempo, mmss } from '../lib/formatos'
import toast, { Toaster } from 'react-hot-toast'
import { toastOptions } from '../lib/themeStyles'
import SelectorEjercicio from './SelectorEjercicio'
import SelectorFormato from './SelectorFormato'
import PanelSustitutos from './PanelSustitutos'
import PesoSugerido from './PesoSugerido'
import RegistrarResultados from './RegistrarResultados'
import Sidecart from './Sidecart'

// No hay ícono de alfiler/thumbtack en Heroicons — se dibuja a mano, en el mismo estilo
// (viewBox 24, trazo redondeado) que el resto de los íconos de este panel. Relleno cuando está
// fijado, sólo el trazo cuando no — la misma convención que "guardado/no guardado" en cualquier
// lado.
function PinIcon({ filled, className }) {
  return filled ? (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2a1 1 0 0 1 1 1v1.35a4.5 4.5 0 0 1 3.25 4.33v3.02l1.66 2.49a1 1 0 0 1-.83 1.56H13v5.25a1 1 0 1 1-2 0v-5.25H6.92a1 1 0 0 1-.83-1.56l1.66-2.49V8.68A4.5 4.5 0 0 1 11 4.35V3a1 1 0 0 1 1-1Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2v2.35m0 0a4.5 4.5 0 0 0-3.25 4.33v3.02l-1.66 2.49a1 1 0 0 0 .83 1.56h8.16a1 1 0 0 0 .83-1.56l-1.66-2.49V8.68A4.5 4.5 0 0 0 12 4.35Z" />
      <path d="M12 15.67V21" />
    </svg>
  )
}

// Los ejercicios de una estación, como bloques que se reordenan arrastrando o con flechas.
// Un solo componente para las dos pantallas que necesitan esto — el panel de "agregar
// ejercicio" (mientras se arma) y el panel de "ver estación" (una vez armada) — así que
// reordenar se comporta igual en los dos lugares en vez de mantenerse por separado.
//
// Tocar el nombre abre el editor completo del ejercicio: no hay un lápiz aparte, el bloque
// entero es el botón de editar.
function ListaBloques({ filas, onReordenar, onEditar, onEliminar, onCambiar, onTogglePin }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  return (
    <div className="space-y-2">
      {filas.map((se, idx) => {
        const enDrag = dragOverIndex === idx && dragIndex !== null && dragIndex !== idx
        const meta = [se.setsReps, se.weightKg ? `${se.weightKg}kg` : null].filter(Boolean).join(' · ')
        return (
          <div
            key={se.id}
            draggable
            onDragStart={() => setDragIndex(idx)}
            onDragOver={(e) => {
              e.preventDefault()
              if (dragIndex !== null && dragIndex !== idx) setDragOverIndex(idx)
            }}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== idx) onReordenar(dragIndex, idx)
              setDragIndex(null)
              setDragOverIndex(null)
            }}
            onDragEnd={() => {
              setDragIndex(null)
              setDragOverIndex(null)
            }}
            className={`p-2.5 rounded-xl border text-xs ${
              enDrag ? 'border-brand border-dashed bg-brand/5' : 'border-border-default bg-bg-secondary'
            }`}
          >
            <div className="flex items-start gap-2">
              <Bars2Icon className="h-3.5 w-4 text-text-muted mt-0.5 flex-shrink-0 cursor-grab" />
              <span className="w-[18px] h-[18px] rounded-full border border-text-primary text-[10px] font-bold text-text-primary flex items-center justify-center flex-shrink-0 mt-px">
                {idx + 1}
              </span>
              <button type="button" onClick={() => onEditar(se)} className="flex-1 min-w-0 text-left">
                <p className="font-medium text-text-primary line-clamp-2 hover:text-brand">{se.exercises?.name}</p>
                {meta && <p className="text-text-tertiary truncate mt-0.5">{meta}</p>}
              </button>
              <div className="flex gap-0.5 flex-shrink-0">
                {onTogglePin && (
                  <button
                    type="button"
                    onClick={() => onTogglePin(se)}
                    className={`p-0.5 ${se.isPinned ? 'text-brand' : 'text-text-tertiary hover:text-brand'}`}
                    title={
                      se.isPinned
                        ? 'Fijo — no rota entre sesiones. El peso se puede seguir ajustando cada semana. Tocá para soltarlo.'
                        : 'Fijar — el motor nunca sustituye este ejercicio en sesiones futuras (el peso sigue pudiendo cambiar). Tocá para fijarlo.'
                    }
                  >
                    <PinIcon filled={!!se.isPinned} className="h-3 w-3" />
                  </button>
                )}
                {onCambiar && (
                  <button
                    type="button"
                    onClick={() => onCambiar(se)}
                    className="p-0.5 text-text-tertiary hover:text-brand"
                    title="Cambiar por otro del mismo patrón"
                  >
                    <ArrowPathIcon className="h-3 w-3" />
                  </button>
                )}
                <button type="button" onClick={() => onEliminar(se)} className="p-0.5 text-text-tertiary hover:text-error">
                  <TrashIcon className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-1 mt-1.5">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => onReordenar(idx, idx - 1)}
                className="p-1 rounded border border-border-default text-text-secondary disabled:opacity-30"
              >
                <ChevronUpIcon className="h-3 w-3" />
              </button>
              <button
                type="button"
                disabled={idx === filas.length - 1}
                onClick={() => onReordenar(idx, idx + 1)}
                className="p-1 rounded border border-border-default text-text-secondary disabled:opacity-30"
              >
                <ChevronDownIcon className="h-3 w-3" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

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
    isPinned: false
  })

  // La modalidad es de la ESTACIÓN, no de cada ejercicio — un solo control arriba de todo del
  // panel, no uno por fila. El default siempre ocupa el bloque entero (AMRAP, 360s = 6:00),
  // nunca más que eso: se recalcula desde los ejercicios ya cargados de la estación al abrir el
  // panel (openExerciseModal), y se sincroniza a todas las filas de la estación al guardar
  // cualquiera de ellas (saveExerciseToSession).
  const [estacionFormato, setEstacionFormato] = useState({
    formato: 'AMRAP',
    rondas: 1,
    trabajoSeg: 360,
    descansoSeg: 0
  })
  // La estación que se está viendo/editando en su propio panel (drag para reordenar, cambiar y
  // borrar ejercicios) — distinto del panel de arriba, que es para cargar un ejercicio nuevo.
  const [estacionAbierta, setEstacionAbierta] = useState(null) // { sessionId, boxNumber } | null

  // Expanded sessions
  const [expandedSessions, setExpandedSessions] = useState({})
  const [generating, setGenerating] = useState(false)
  const [sustituyendo, setSustituyendo] = useState(null)
  // La sesión sobre la que se está cargando el peso/reps real que el socio efectivamente
  // levantó — separado de sustituyendo/exerciseForm porque no edita el plan, registra lo que
  // pasó. Ver RegistrarResultados.
  const [registrandoResultados, setRegistrandoResultados] = useState(null)
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

    // La modalidad ya cargada en la estación, si hay alguna fila — todas comparten la misma,
    // así que cualquiera sirve de referencia. Estación recién empezada: bloque entero por
    // default, nunca más que eso.
    const filasDeLaEstacion = (yaEnSesion || []).filter(
      (se) => !isCooldown && se.boxNumber === boxNumber
    )
    const formatoDeLaEstacion = filasDeLaEstacion[0]
      ? {
          formato: filasDeLaEstacion[0].formato || 'Series',
          rondas: filasDeLaEstacion[0].rondas ?? null,
          trabajoSeg: filasDeLaEstacion[0].trabajoSeg ?? null,
          descansoSeg: filasDeLaEstacion[0].descansoSeg ?? null
        }
      : { formato: 'AMRAP', rondas: 1, trabajoSeg: BLOQUE_SEG, descansoSeg: 0 }
    setEstacionFormato(formatoDeLaEstacion)

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
        isPinned: sessionExercise.isPinned || false
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
        isPinned: false
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

    // El tope se corta acá y no sólo en el aviso del selector: el aviso lo puede pasar por alto
    // quien está cargando rápido, y lo que llega a la tabla es lo que después corre en el box.
    // Es el tiempo de la ESTACIÓN entera — el mismo sin importar cuántos ejercicios tenga.
    const totalEstacion = esPorTiempo(estacionFormato.formato) ? duracionSeg(estacionFormato) : 0
    if (totalEstacion > BLOQUE_SEG) {
      toast.error(
        `La estación queda en ${mmss(totalEstacion)} y el tope es ${mmss(BLOQUE_SEG)}. ` +
          'Bajá rondas o tiempo antes de confirmar.',
        toastOptions
      )
      return
    }

    // Para un circuito por tiempo, "series x reps" no lo escribe el coach por ejercicio — lo
    // define el formato entero (ver el input deshabilitado de arriba). Se fuerza acá también
    // por si el estado quedó de un ejercicio anterior con otro formato.
    const repsDelFormato = REPS_POR_FORMATO[estacionFormato.formato]
    const payload = {
      ...exerciseForm,
      ...(repsDelFormato ? { setsReps: repsDelFormato } : {}),
      ...(exerciseForm.isCooldown ? {} : estacionFormato),
    }

    try {
      setSaving(true)
      if (editingItem) {
        await routinesService.updateSessionExercise(editingItem.id, payload)
        toast.success('Ejercicio actualizado', toastOptions)
      } else {
        await routinesService.addExerciseToSession(payload)
        toast.success('Ejercicio agregado', toastOptions)
      }
      // La modalidad se decide una vez por estación: si cambió acá, el resto de sus filas tiene
      // que quedar igual — si no, cada fila cuenta un tiempo distinto para la misma estación.
      if (!exerciseForm.isCooldown && exerciseForm.boxNumber) {
        await routinesService.syncEstacionFormato(
          exerciseForm.sessionId,
          exerciseForm.boxNumber,
          estacionFormato,
          editingItem?.id
        )
      }
      // El panel se queda abierto: se sigue armando la estación agregando el próximo ejercicio.
      // Cierra recién con Cancelar, Confirmar entrenamiento o la X.
      //
      // exerciseOrder es único POR SESIÓN (no por estación) — si se dejaba el mismo valor con
      // el que se acababa de guardar, el segundo ejercicio de cualquier estación chocaba contra
      // ese mismo número y el insert fallaba con un 409 silencioso. No hace falta esperar el
      // refetch para saber el próximo: si prev.exerciseOrder se usó y se guardó bien, el
      // siguiente libre es ese +1 — nadie más edita esta sesión al mismo tiempo desde acá.
      setEditingItem(null)
      setExerciseForm((prev) => ({
        ...prev,
        exerciseId: '',
        exerciseOrder: prev.exerciseOrder + 1,
        setsReps: '3x12',
        restTime: '60s',
        repetitionTime: '',
        weightKg: '',
        microPause: '',
        notes: ''
      }))
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

  // Reordenar arrastrando: swap inmediato en memoria para que la UI responda al toque, y
  // persiste el nuevo orden de toda la estación en un solo viaje a la base.
  const moverEjercicioDeEstacion = async (sessionId, boxNumber, filas, desde, hacia) => {
    if (hacia < 0 || hacia >= filas.length) return
    const reordenadas = filas.slice()
    const [movida] = reordenadas.splice(desde, 1)
    reordenadas.splice(hacia, 0, movida)
    // Optimista: refleja el nuevo orden ya mismo, antes de que vuelva el fetch.
    setSelectedRoutine((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        routineSessions: prev.routineSessions.map((s) =>
          s.id !== sessionId
            ? s
            : {
                ...s,
                sessionExercises: s.sessionExercises.map((se) => {
                  // reordenadas[idx] es la propia fila (nunca cambió su exerciseOrder) — el
                  // valor nuevo es el que SE QUEDÓ en esa posición, o sea el de filas[idx].
                  const idx = reordenadas.findIndex((r) => r.id === se.id)
                  return idx === -1 ? se : { ...se, exerciseOrder: filas[idx].exerciseOrder }
                })
              }
        )
      }
    })
    try {
      await routinesService.reorderSessionExercises(
        sessionId,
        reordenadas.map((r, i) => ({ id: r.id, order: filas[i].exerciseOrder }))
      )
    } catch (error) {
      Sentry.captureException(error, { extra: { context: 'Error reordering station exercises' } })
      toast.error(error?.message || String(error), toastOptions)
      fetchRoutineDetail(selectedRoutine.id)
    }
  }

  // Fijar/soltar un ejercicio directamente desde el bloque, sin abrir el editor completo — el
  // coach lo hace tanto armando la rutina como mirándola ya armada.
  const togglePinEjercicio = async (se) => {
    try {
      await routinesService.updateSessionExercise(se.id, { isPinned: !se.isPinned })
      fetchRoutineDetail(selectedRoutine.id)
    } catch (error) {
      Sentry.captureException(error, { extra: { context: 'Error toggling exercise pin' } })
      toast.error(error?.message || String(error), toastOptions)
    }
  }

  // Los ejercicios de una estación, en orden — la usan tanto el panel de agregar ejercicio
  // (aparecen a la derecha en cuanto hay uno) como el panel de ver la estación entera.
  const filasDeEstacion = (sessionId, boxNumber) => {
    if (!boxNumber) return []
    const sesion = selectedRoutine?.routineSessions?.find((x) => x.id === sessionId)
    return (sesion?.sessionExercises || [])
      .filter((se) => se.boxNumber === boxNumber)
      .sort((a, b) => a.exerciseOrder - b.exerciseOrder)
  }

  const filasEstacionActual = exerciseForm.isCooldown
    ? []
    : filasDeEstacion(exerciseForm.sessionId, exerciseForm.boxNumber)

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
        <div className="w-full space-y-4">
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

        {/*
          La rutina abre como sidecart, no como columna al lado de la lista: al elegir un socio
          lo que importa es su rutina, y la lista sólo servía para volver. Es el primero de la
          pila — la estación abre encima (`zIndex` mayor), y adentro de ella el ejercicio.
          Un paso más ancho que el de estación: acá entran cinco estaciones en fila, allá una sola.
        */}
        <Sidecart
          isOpen={Boolean(selectedRoutine)}
          onClose={() => setSelectedRoutine(null)}
          title={selectedRoutine?.title ?? ''}
          subtitle={
            selectedRoutine
              ? `${selectedRoutine.users?.firstName ?? ''} ${selectedRoutine.users?.lastName ?? ''}`.trim() || undefined
              : undefined
          }
          size="lg"
          zIndex={40}
        >
        {selectedRoutine && (
          <div>
            {loadingDetail ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* El nombre y el socio ya los dice el encabezado del sidecart; acá queda sólo
                    lo que ese encabezado no cubre: estado, vigencia y las acciones. */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedRoutine.status)}
                    <span className="text-xs text-text-tertiary">
                      {formatDate(selectedRoutine.validFrom)} - {formatDate(selectedRoutine.validUntil)}
                    </span>
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
                              {/* Qué estaciones están completas y con qué modalidad, en vez de
                                  "N ejercicios" — eso no decía si la sesión estaba armada. */}
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {[1, 2, 3, 4, 5].map((boxNum) => {
                                  const filas = (session.sessionExercises || []).filter((se) => se.boxNumber === boxNum)
                                  const primera = filas[0]
                                  const modalidad = primera
                                    ? esPorTiempo(primera.formato)
                                      ? comoTexto(primera.formato, primera)
                                      : 'Series × reps'
                                    : null
                                  return (
                                    <span
                                      key={boxNum}
                                      title={`Estación ${boxNum}${modalidad ? ` · ${modalidad}` : ' · sin ejercicios'}`}
                                      className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${
                                        primera
                                          ? 'bg-brand text-white'
                                          : 'bg-bg-surface border border-border-default text-text-tertiary'
                                      }`}
                                    >
                                      {boxNum}
                                    </span>
                                  )
                                })}
                                <span className="text-xs text-text-tertiary">
                                  {mmss(
                                    [1, 2, 3, 4, 5].filter((boxNum) =>
                                      (session.sessionExercises || []).some((se) => se.boxNumber === boxNum)
                                    ).length * BLOQUE_SEG
                                  )}{' '}
                                  total
                                </span>
                                {selectedRoutine?.arquetipos?.nombre && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-medium">
                                    {selectedRoutine.arquetipos.nombre}
                                  </span>
                                )}
                              </div>
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
                              onClick={() => setRegistrandoResultados(session)}
                              className="p-1 text-text-tertiary hover:text-brand"
                              title="Cargar lo que el socio realmente levantó"
                            >
                              <ClipboardDocumentListIcon className="h-3.5 w-3.5" />
                            </button>
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

                                const primera = boxExercises[0]
                                const modalidadTexto = primera
                                  ? esPorTiempo(primera.formato)
                                    ? comoTexto(primera.formato, primera)
                                    : 'Series × reps'
                                  : null

                                return (
                                  <div key={boxNum} className="bg-bg-secondary min-h-[150px]">
                                    {/* Station Header — un solo botón de editar acá, no uno por
                                        ejercicio: cambiar/borrar cada uno vive en ese panel. */}
                                    <div className="bg-brand/10 px-2 py-1.5 border-b border-border-default">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <span className="text-xs font-semibold text-brand">Estación {boxNum}</span>
                                        <span className="text-xs text-text-tertiary">({boxExercises.length})</span>
                                        <button
                                          onClick={() => setEstacionAbierta({ sessionId: session.id, boxNumber: boxNum })}
                                          className="p-0.5 text-text-tertiary hover:text-brand"
                                          title="Editar estación"
                                        >
                                          <PencilIcon className="h-3 w-3" />
                                        </button>
                                      </div>
                                      {modalidadTexto && (
                                        <p className="mt-0.5 text-center text-[10px] font-medium text-brand truncate">
                                          {modalidadTexto}
                                        </p>
                                      )}
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

                                    {/* Exercises in Station — sólo lectura: cambiar, borrar y
                                        reordenar viven en el panel de "Editar estación". */}
                                    <div className="p-2 space-y-1.5">
                                      {boxExercises.map((se, idx) => (
                                        <div key={se.id} className="bg-bg-surface p-2 rounded text-xs">
                                          <p className="font-medium text-text-primary line-clamp-2" title={se.exercises?.name}>
                                            {idx + 1}. {se.exercises?.name}
                                          </p>
                                          <p className="text-text-tertiary truncate">
                                            {se.setsReps}
                                            {se.weightKg && ` • ${se.weightKg}kg`}
                                          </p>
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
        </Sidecart>
      </div>

      {/* Routine Modal */}
      <Sidecart
        isOpen={showRoutineModal}
        onClose={() => setShowRoutineModal(false)}
        zIndex={70}
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
        zIndex={70}
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
        zIndex={70}
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

      <Sidecart
        isOpen={Boolean(registrandoResultados)}
        zIndex={70}
        onClose={() => setRegistrandoResultados(null)}
        title="Resultados reales"
        subtitle={
          registrandoResultados
            ? `Sesión ${registrandoResultados.sessionNumber}${
                selectedRoutine?.users ? ` · ${selectedRoutine.users.firstName} ${selectedRoutine.users.lastName}` : ''
              }`
            : undefined
        }
        size="lg"
      >
        {registrandoResultados && (
          <RegistrarResultados
            session={registrandoResultados}
            clientId={selectedRoutine?.clientId}
            onGuardado={() => fetchRoutineDetail(selectedRoutine.id)}
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
        zIndex={70}
        onClose={() => setShowExerciseModal(false)}
        title={
          exerciseForm.isCooldown
            ? 'Cooldown'
            : `Crear entrenamiento para Estación ${exerciseForm.boxNumber ?? ''}`
        }
        subtitle={
          exerciseForm.isCooldown
            ? 'No va en una estación'
            : (() => {
                const sesion = selectedRoutine?.routineSessions?.find((s) => s.id === exerciseForm.sessionId)
                return sesion?.sessionNumber ? `Sesión ${sesion.sessionNumber}` : undefined
              })()
        }
        size="2xl"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowExerciseModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setShowExerciseModal(false)}
              disabled={filasEstacionActual.length === 0}
              className="btn-primary disabled:opacity-50"
            >
              Confirmar entrenamiento
            </button>
          </div>
        }
      >
        {/* Paso 1 — la estación ya está fija (viene del "+ Agregar" de su columna, no se
            vuelve a preguntar acá, y la línea A/B no aparece: la decide la cola). La modalidad
            es de la estación entera, una sola vez arriba de todo — no una por ejercicio. */}
        {exerciseForm.isCooldown ? (
          <div className="flex items-center gap-2 px-3 py-2 mb-6 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-sm text-blue-700 font-medium">Ejercicio de Cooldown</span>
          </div>
        ) : (
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand mb-1">Paso 1</p>
            <label className="form-label">Modalidad de la estación</label>
            <SelectorFormato valor={estacionFormato} onChange={setEstacionFormato} turnoSeg={turnoSeg} />
            {CUPO_POR_FORMATO[estacionFormato.formato] && (
              // El circuito comparte un solo reloj entre todos sus ejercicios (por eso el
              // formato pide una cantidad fija, no "los que quieras hasta llenar 6:00") — sin
              // esto no había forma de saber cuántos ejercicios le faltan a la estación.
              <p className="mt-2 text-xs text-text-tertiary">
                {estacionFormato.formato} — circuito de{' '}
                <strong className="text-text-secondary">{CUPO_POR_FORMATO[estacionFormato.formato]} ejercicios</strong>
                {filasEstacionActual.length >= CUPO_POR_FORMATO[estacionFormato.formato]
                  ? ' — completo.'
                  : ` — llevás ${filasEstacionActual.length}, faltan ${
                      CUPO_POR_FORMATO[estacionFormato.formato] - filasEstacionActual.length
                    }.`}
              </p>
            )}
          </div>
        )}

        <div className={`flex items-start ${filasEstacionActual.length > 0 ? 'gap-6' : ''}`}>
          <form
            id="form-ejercicio-sesion"
            onSubmit={saveExerciseToSession}
            className={`space-y-4 min-w-0 ${filasEstacionActual.length > 0 ? 'flex-1' : 'w-full max-w-xl'}`}
          >
            <div>
              {!exerciseForm.isCooldown && (
                <p className="text-[11px] font-bold uppercase tracking-wide text-brand mb-1">Paso 2</p>
              )}
              <label className="form-label">Buscar ejercicio</label>
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

            {!exerciseForm.isCooldown && (
              <button
                type="button"
                onClick={() => setExerciseForm({ ...exerciseForm, isPinned: !exerciseForm.isPinned })}
                title={
                  exerciseForm.isPinned
                    ? 'Fijo — el motor nunca sustituye este ejercicio en sesiones futuras. El peso se puede seguir ajustando cada semana. Tocá para soltarlo.'
                    : 'Fijar — el motor nunca va a sustituir este ejercicio en sesiones futuras (el peso sigue pudiendo cambiar semana a semana). Tocá para fijarlo.'
                }
                className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 border ${
                  exerciseForm.isPinned
                    ? 'border-brand text-brand bg-brand/5'
                    : 'border-border-default text-text-tertiary hover:text-brand'
                }`}
              >
                <PinIcon filled={exerciseForm.isPinned} className="h-3.5 w-3.5" />
                {exerciseForm.isPinned ? 'Fijo — no rota' : 'Fijar ejercicio'}
              </button>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="form-label">Series x Reps *</label>
                {REPS_POR_FORMATO[estacionFormato.formato] ? (
                  // Un circuito por tiempo corre con un solo reloj compartido por toda la
                  // estación (ver SelectorFormato) — "series x reps" por ejercicio no
                  // significa nada acá. Se muestra lo que realmente hace cada vuelta, fijo.
                  <input
                    type="text"
                    value={REPS_POR_FORMATO[estacionFormato.formato]}
                    className="form-input"
                    disabled
                  />
                ) : (
                  <input
                    type="text"
                    value={exerciseForm.setsReps}
                    onChange={(e) => setExerciseForm({ ...exerciseForm, setsReps: e.target.value })}
                    className="form-input"
                    placeholder="3x12"
                    required
                  />
                )}
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

            <div className="grid grid-cols-2 gap-4">
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
                placeholder={
                  estacionFormato.formato === 'A completar'
                    ? 'Submodalidad, si tiene una (ej. escalera 1-1-2-2-3-3)...'
                    : 'Instrucciones específicas...'
                }
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary disabled:opacity-50 w-full justify-center"
              >
                {saving ? 'Guardando...' : editingItem ? 'Guardar cambios' : '+ Agregar a la estación'}
              </button>
            </div>
          </form>

          {/* Los bloques de la estación: aparecen con el primer ejercicio, no antes. Se
              reordenan arrastrando o con las flechas — el orden es la posición, no un número
              que haya que escribir. */}
          {filasEstacionActual.length > 0 && (
            <div className="w-72 flex-shrink-0 border-l border-border-default pl-5">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3">
                Ejercicios de la estación
              </p>
              <ListaBloques
                filas={filasEstacionActual}
                onReordenar={(desde, hacia) =>
                  moverEjercicioDeEstacion(exerciseForm.sessionId, exerciseForm.boxNumber, filasEstacionActual, desde, hacia)
                }
                onEditar={(se) => openExerciseModal(exerciseForm.sessionId, se, exerciseForm.boxNumber)}
                onEliminar={(se) => removeExerciseFromSession(se.id)}
                onCambiar={(se) => setSustituyendo({ fila: se, estacion: exerciseForm.boxNumber, boxId: se.boxId })}
                onTogglePin={togglePinEjercicio}
              />
            </div>
          )}
        </div>
      </Sidecart>

      {/* Ver/editar la estación entera: modalidad + los ejercicios ya cargados, reordenables.
          Se abre desde el único botón de editar del título de cada estación en el grid —
          cambiar y borrar un ejercicio puntual vive acá, no suelto en el grid. */}
      <Sidecart
        isOpen={Boolean(estacionAbierta)}
        onClose={() => setEstacionAbierta(null)}
        title={`Estación ${estacionAbierta?.boxNumber ?? ''}`}
        subtitle={(() => {
          const sesion = selectedRoutine?.routineSessions?.find((s) => s.id === estacionAbierta?.sessionId)
          return sesion?.sessionNumber ? `Sesión ${sesion.sessionNumber}` : undefined
        })()}
        size="md"
        zIndex={60}
        footer={
          <div className="flex justify-end">
            <button type="button" onClick={() => setEstacionAbierta(null)} className="btn-secondary">
              Cerrar
            </button>
          </div>
        }
      >
        {estacionAbierta && (() => {
          const filas = filasDeEstacion(estacionAbierta.sessionId, estacionAbierta.boxNumber)
          const primera = filas[0]
          const timed = primera && esPorTiempo(primera.formato)
          const duracion = timed ? duracionSeg(primera) : 0
          const excede = duracion > BLOQUE_SEG
          return (
            <div className="space-y-5">
              {primera ? (
                <div
                  className={`p-3 rounded-xl border text-sm ${
                    excede ? 'bg-red-50 border-red-200 text-red-800' : 'bg-brand/5 border-brand/20 text-text-primary'
                  }`}
                >
                  <span className="font-semibold">
                    {timed ? comoTexto(primera.formato, primera) : 'Series × reps'}
                  </span>
                  {timed && (
                    <span className={excede ? 'text-red-700' : 'text-text-tertiary'}>
                      {' · '}
                      {mmss(duracion)} de {mmss(BLOQUE_SEG)}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary">Todavía no tiene ejercicios cargados.</p>
              )}

              {filas.length > 0 && (
                <ListaBloques
                  filas={filas}
                  onReordenar={(desde, hacia) =>
                    moverEjercicioDeEstacion(estacionAbierta.sessionId, estacionAbierta.boxNumber, filas, desde, hacia)
                  }
                  onEditar={(se) => openExerciseModal(estacionAbierta.sessionId, se, estacionAbierta.boxNumber)}
                  onEliminar={(se) => removeExerciseFromSession(se.id)}
                  onCambiar={(se) => setSustituyendo({ fila: se, estacion: estacionAbierta.boxNumber, boxId: se.boxId })}
                  onTogglePin={togglePinEjercicio}
                />
              )}

              <button
                type="button"
                onClick={() => openExerciseModal(estacionAbierta.sessionId, null, estacionAbierta.boxNumber)}
                className="w-full py-2 border border-dashed border-border-default rounded-lg text-xs text-text-tertiary hover:text-brand hover:border-brand transition-colors flex items-center justify-center gap-1"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Agregar ejercicio
              </button>
            </div>
          )
        })()}
      </Sidecart>
    </div>
  )
}

