import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import {
  CheckCircle2, Clock, AlertTriangle, Circle, Plus, Calendar,
  ChevronLeft, ChevronRight, StickyNote, Briefcase, Pin, Trash2,
  LogOut, Edit3, X, ArrowRightCircle, Search, Copy, Check,
  ArrowUpRight, Flag, CheckSquare, Square
} from 'lucide-react'

const getLocalDateStr = (dateObj = new Date()) => {
  const y = dateObj.getFullYear()
  const m = String(dateObj.getMonth() + 1).padStart(2, '0')
  const d = String(dateObj.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const shiftDate = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return getLocalDateStr(new Date(y, m - 1, d + days))
}

const diffDays = (fromStr, toStr) => {
  const [y1, m1, d1] = fromStr.split('-').map(Number)
  const [y2, m2, d2] = toStr.split('-').map(Number)
  return Math.floor((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'bg-zinc-800 text-zinc-300 border-zinc-700', icon: Circle },
  en_curso: { label: 'En curso', color: 'bg-blue-950/60 text-blue-300 border-blue-800', icon: Clock },
  faltante: { label: 'Faltante', color: 'bg-amber-950/60 text-amber-300 border-amber-700', icon: AlertTriangle },
  completado: { label: 'Completado', color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800', icon: CheckCircle2 },
}

const PRIORITY_CONFIG = {
  alta: { label: 'Alta', weight: 3, badge: 'bg-red-950/70 text-red-300 border-red-800/70' },
  media: { label: 'Media', weight: 2, badge: 'bg-zinc-800 text-zinc-300 border-zinc-700' },
  baja: { label: 'Baja', weight: 1, badge: 'bg-zinc-900 text-zinc-500 border-zinc-800' },
}

const NOTE_COLORS = {
  zinc: { label: 'General', border: 'border-zinc-800', dot: 'bg-zinc-500' },
  blue: { label: 'Cliente', border: 'border-blue-800/80 bg-blue-950/10', dot: 'bg-blue-500' },
  amber: { label: 'Idea', border: 'border-amber-800/80 bg-amber-950/10', dot: 'bg-amber-500' },
  emerald: { label: 'Técnico', border: 'border-emerald-800/80 bg-emerald-950/10', dot: 'bg-emerald-500' },
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const [activeTab, setActiveTab] = useState('tasks')
  const [selectedDate, setSelectedDate] = useState(getLocalDateStr())
  const [tasks, setTasks] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(false)

  // Filtros y búsqueda
  const [statusFilter, setStatusFilter] = useState('todos')
  const [categoryFilter, setCategoryFilter] = useState('todas')
  const [taskSearch, setTaskSearch] = useState('')
  const [noteSearch, setNoteSearch] = useState('')
  const [copiedSummary, setCopiedSummary] = useState(false)

  // Modal de Tarea
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [newSubtaskText, setNewSubtaskText] = useState('')
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', category: 'General', priority: 'media',
    status: 'pendiente', blocker_reason: '', subtasks: []
  })

  // Modal de Nota
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [noteForm, setNoteForm] = useState({ title: '', content: '', color: 'zinc' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const syncAndFetchTasks = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    const today = getLocalDateStr()

    await supabase
      .from('tasks')
      .update({ scheduled_date: today })
      .eq('user_id', session.user.id)
      .lt('scheduled_date', today)
      .neq('status', 'completado')

    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('scheduled_date', selectedDate)
      .order('created_at', { ascending: false })

    setTasks(data || [])
    setLoading(false)
  }, [session, selectedDate])

  const fetchNotes = useCallback(async () => {
    if (!session?.user) return
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', session.user.id)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    setNotes(data || [])
  }, [session])

  useEffect(() => {
    if (session) {
      syncAndFetchTasks()
      fetchNotes()
    }
  }, [session, syncAndFetchTasks, fetchNotes])

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthError('')
    const fn = authMode === 'login'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password })
    const { error } = await fn
    if (error) setAuthError(error.message)
  }

  // CRUD Tareas
  const openTaskModal = (task = null) => {
    setNewSubtaskText('')
    if (task) {
      setEditingTask(task)
      setTaskForm({
        title: task.title,
        description: task.description || '',
        category: task.category || 'General',
        priority: task.priority || 'media',
        status: task.status,
        blocker_reason: task.blocker_reason || '',
        subtasks: Array.isArray(task.subtasks) ? task.subtasks : []
      })
    } else {
      setEditingTask(null)
      setTaskForm({
        title: '', description: '', category: 'General', priority: 'media',
        status: 'pendiente', blocker_reason: '', subtasks: []
      })
    }
    setIsTaskModalOpen(true)
  }

  const addSubtaskToForm = () => {
    if (!newSubtaskText.trim()) return
    setTaskForm(prev => ({
      ...prev,
      subtasks: [...prev.subtasks, { id: crypto.randomUUID(), text: newSubtaskText.trim(), done: false }]
    }))
    setNewSubtaskText('')
  }

  const removeSubtaskFromForm = (id) => {
    setTaskForm(prev => ({ ...prev, subtasks: prev.subtasks.filter(s => s.id !== id) }))
  }

  const saveTask = async (e) => {
    e.preventDefault()
    if (!taskForm.title.trim()) return

    const payload = {
      ...taskForm,
      blocker_reason: taskForm.status === 'faltante' ? taskForm.blocker_reason : taskForm.blocker_reason || null,
      completed_at: taskForm.status === 'completado' ? new Date().toISOString() : null
    }

    const { error } = editingTask
      ? await supabase.from('tasks').update(payload).eq('id', editingTask.id)
      : await supabase.from('tasks').insert({
          ...payload,
          user_id: session.user.id,
          original_date: selectedDate,
          scheduled_date: selectedDate,
        })

    if (error) {
      alert('Error al guardar el trabajo: ' + error.message)
      return
    }
    setIsTaskModalOpen(false)
    syncAndFetchTasks()
  }

  const changeTaskStatus = async (task, newStatus) => {
    let blocker = task.blocker_reason
    if (newStatus === 'faltante' && !blocker) {
      const reason = window.prompt('Motivo del faltante / bloqueo (opcional):', '')
      if (reason !== null) blocker = reason.trim()
    }
    await supabase.from('tasks').update({
      status: newStatus,
      blocker_reason: blocker,
      completed_at: newStatus === 'completado' ? new Date().toISOString() : null
    }).eq('id', task.id)
    syncAndFetchTasks()
  }

  const toggleCardSubtask = async (task, subtaskId) => {
    const updated = (task.subtasks || []).map(s =>
      s.id === subtaskId ? { ...s, done: !s.done } : s
    )
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, subtasks: updated } : t))
    await supabase.from('tasks').update({ subtasks: updated }).eq('id', task.id)
  }

  const deleteTask = async (id) => {
    await supabase.from('tasks').delete().eq('id', id)
    syncAndFetchTasks()
  }

  // CRUD Notas
  const openNoteModal = (note = null) => {
    if (note) {
      setEditingNote(note)
      setNoteForm({ title: note.title, content: note.content, color: note.color || 'zinc' })
    } else {
      setEditingNote(null)
      setNoteForm({ title: '', content: '', color: 'zinc' })
    }
    setIsNoteModalOpen(true)
  }

  const saveNote = async (e) => {
    e.preventDefault()
    if (!noteForm.title.trim()) return

    const { error } = editingNote
      ? await supabase.from('notes').update({ ...noteForm, updated_at: new Date().toISOString() }).eq('id', editingNote.id)
      : await supabase.from('notes').insert({ ...noteForm, user_id: session.user.id })

    if (error) {
      alert('Error al guardar la nota: ' + error.message)
      return
    }
    setIsNoteModalOpen(false)
    fetchNotes()
  }

  const convertNoteToTask = async (note) => {
    const today = getLocalDateStr()
    const { error } = await supabase.from('tasks').insert({
      user_id: session.user.id,
      title: note.title,
      description: note.content,
      category: 'Desde Nota',
      priority: 'media',
      status: 'pendiente',
      original_date: today,
      scheduled_date: today,
      subtasks: []
    })
    if (error) {
      alert('No se pudo convertir en trabajo: ' + error.message)
      return
    }
    setSelectedDate(today)
    await syncAndFetchTasks()
    setActiveTab('tasks')
  }

  const togglePinNote = async (note) => {
    await supabase.from('notes').update({ is_pinned: !note.is_pinned }).eq('id', note.id)
    fetchNotes()
  }

  const deleteNote = async (id) => {
    await supabase.from('notes').delete().eq('id', id)
    fetchNotes()
  }

  // Categorías dinámicas y ordenamiento inteligente
  const categories = useMemo(() => {
    const set = new Set(tasks.map(t => t.category).filter(Boolean))
    return ['todas', ...Array.from(set)]
  }, [tasks])

  const processedTasks = useMemo(() => {
    return tasks
      .filter(t => statusFilter === 'todos' || t.status === statusFilter)
      .filter(t => categoryFilter === 'todas' || t.category === categoryFilter)
      .filter(t => {
        if (!taskSearch.trim()) return true
        const q = taskSearch.toLowerCase()
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.category || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const aDone = a.status === 'completado' ? 1 : 0
        const bDone = b.status === 'completado' ? 1 : 0
        if (aDone !== bDone) return aDone - bDone

        const pA = PRIORITY_CONFIG[a.priority]?.weight || 2
        const pB = PRIORITY_CONFIG[b.priority]?.weight || 2
        if (pA !== pB) return pB - pA

        const cA = diffDays(a.original_date, a.scheduled_date)
        const cB = diffDays(b.original_date, b.scheduled_date)
        return cB - cA
      })
  }, [tasks, statusFilter, categoryFilter, taskSearch])

  const filteredNotes = useMemo(() => {
    if (!noteSearch.trim()) return notes
    const q = noteSearch.toLowerCase()
    return notes.filter(n =>
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    )
  }, [notes, noteSearch])

  const copyDailySummary = () => {
    const completed = tasks.filter(t => t.status === 'completado')
    const active = tasks.filter(t => t.status !== 'completado')

    const lines = [`*Resumen Operativo (${selectedDate})*`, '']
    lines.push(`*Completados (${completed.length}):*`)
    if (completed.length === 0) lines.push('- Ninguno')
    completed.forEach(t => lines.push(`- [OK] ${t.title} (${t.category})`))

    lines.push('', `*Pendientes / En curso (${active.length}):*`)
    if (active.length === 0) lines.push('- Todo al día')
    active.forEach(t => {
      const tag = STATUS_CONFIG[t.status]?.label || t.status
      const extra = t.status === 'faltante' && t.blocker_reason ? ` -> Falta: ${t.blocker_reason}` : ''
      lines.push(`- [${tag}] ${t.title} (${t.category})${extra}`)
    })

    navigator.clipboard.writeText(lines.join('\n'))
    setCopiedSummary(true)
    setTimeout(() => setCopiedSummary(false), 2000)
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <h1 className="text-xl font-bold mb-1">Panel Operativo</h1>
          <p className="text-sm text-zinc-400 mb-6">Control diario de trabajos y notas</p>
          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="email" required placeholder="Correo electrónico"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <input
              type="password" required placeholder="Contraseña"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            {authError && <p className="text-xs text-red-400">{authError}</p>}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg text-sm transition">
              {authMode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>
          <button
            onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            className="w-full text-center text-xs text-zinc-400 hover:text-zinc-200 mt-4"
          >
            {authMode === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
          </button>
        </div>
      </div>
    )
  }

  const todayStr = getLocalDateStr()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-12">
      <header className="border-b border-zinc-800 bg-zinc-900/70 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'tasks' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <Briefcase className="w-4 h-4" /> Trabajos
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'notes' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <StickyNote className="w-4 h-4" /> Anotaciones
            </button>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-zinc-400 hover:text-red-400 p-2 rounded-lg transition"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'tasks' ? (
          <>
            {/* Barra de Fecha y Acciones */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
                <button onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} className="p-1.5 hover:bg-zinc-800 rounded-lg">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedDate(todayStr)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg ${selectedDate === todayStr ? 'bg-zinc-800 text-blue-400' : 'text-zinc-400'}`}
                >
                  Hoy
                </button>
                <div className="flex items-center gap-1.5 px-2 text-sm">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  <input
                    type="date" value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-zinc-200 text-xs focus:outline-none"
                  />
                </div>
                <button onClick={() => setSelectedDate(shiftDate(selectedDate, 1))} className="p-1.5 hover:bg-zinc-800 rounded-lg">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyDailySummary}
                  className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-3 py-2 rounded-xl text-xs font-medium transition"
                  title="Copiar resumen para WhatsApp"
                >
                  {copiedSummary ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copiedSummary ? 'Copiado' : 'Resumen'}
                </button>
                <button
                  onClick={() => openTaskModal()}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                >
                  <Plus className="w-4 h-4" /> Nuevo Trabajo
                </button>
              </div>
            </div>

            {/* Buscador + Filtro por Categoría */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar trabajo, cliente o detalle..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              {categories.length > 1 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === 'todas' ? 'Todas las categorías' : cat}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Filtros por Estado */}
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setStatusFilter('todos')}
                className={`px-3 py-1 rounded-full text-xs border transition ${
                  statusFilter === 'todos' ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-medium' : 'border-zinc-800 text-zinc-400'
                }`}
              >
                Todos ({tasks.length})
              </button>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const count = tasks.filter(t => t.status === key).length
                return (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`px-3 py-1 rounded-full text-xs border transition ${
                      statusFilter === key ? cfg.color + ' font-medium' : 'border-zinc-800 text-zinc-400'
                    }`}
                  >
                    {cfg.label} ({count})
                  </button>
                )
              })}
            </div>

            {/* Lista de Trabajos */}
            {loading ? (
              <p className="text-sm text-zinc-500 text-center py-10">Sincronizando trabajos...</p>
            ) : processedTasks.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                <p className="text-zinc-400 text-sm">No hay trabajos que coincidan con esta vista.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {processedTasks.map((task) => {
                  const carriedDays = diffDays(task.original_date, task.scheduled_date)
                  const prio = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.media
                  const subs = Array.isArray(task.subtasks) ? task.subtasks : []
                  const doneSubs = subs.filter(s => s.done).length

                  return (
                    <div
                      key={task.id}
                      className={`bg-zinc-900 border rounded-xl p-4 transition ${
                        task.status === 'completado' ? 'border-zinc-800/60 opacity-65' : 'border-zinc-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                              {task.category}
                            </span>
                            <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border ${prio.badge}`}>
                              <Flag className="w-2.5 h-2.5" /> {prio.label}
                            </span>
                            {carriedDays > 0 && task.status !== 'completado' && (
                              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-red-950/70 text-red-300 border border-red-800/60">
                                <ArrowRightCircle className="w-3 h-3" />
                                Arrastrado ({carriedDays} {carriedDays === 1 ? 'día' : 'días'})
                              </span>
                            )}
                            {subs.length > 0 && (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                                Pasos: {doneSubs}/{subs.length}
                              </span>
                            )}
                          </div>

                          <h3 className={`font-medium text-base ${task.status === 'completado' ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
                            {task.title}
                          </h3>

                          {task.description && (
                            <p className="text-sm text-zinc-400 whitespace-pre-line">{task.description}</p>
                          )}

                          {/* Motivo de Faltante / Bloqueo */}
                          {task.status === 'faltante' && task.blocker_reason && (
                            <div className="mt-2 flex items-center gap-2 text-xs bg-amber-950/40 border border-amber-800/60 text-amber-200 px-3 py-1.5 rounded-lg">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span><strong>Motivo:</strong> {task.blocker_reason}</span>
                            </div>
                          )}

                          {/* Mini-checklist interactivo */}
                          {subs.length > 0 && (
                            <div className="mt-2.5 space-y-1 pl-1">
                              {subs.map(sub => (
                                <button
                                  key={sub.id}
                                  type="button"
                                  onClick={() => toggleCardSubtask(task, sub.id)}
                                  className="flex items-center gap-2 text-xs text-left w-full py-0.5 hover:text-zinc-200 transition"
                                >
                                  {sub.done
                                    ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    : <Square className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                  }
                                  <span className={sub.done ? 'line-through text-zinc-500' : 'text-zinc-300'}>
                                    {sub.text}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button onClick={() => openTaskModal(task)} className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteTask(task.id)} className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Selector rápido de estado */}
                      <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-zinc-800/80">
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                          const Icon = cfg.icon
                          const isSelected = task.status === key
                          return (
                            <button
                              key={key}
                              onClick={() => changeTaskStatus(task, key)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition ${
                                isSelected ? cfg.color + ' font-medium' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {cfg.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          /* Vista de Anotaciones */
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold">Anotaciones de la Empresa</h2>
              <button
                onClick={() => openNoteModal()}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Nueva Nota
              </button>
            </div>

            <div className="relative mb-5">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar en anotaciones..."
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            {filteredNotes.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
                <p className="text-zinc-400 text-sm">No hay anotaciones registradas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredNotes.map((note) => {
                  const colorStyle = NOTE_COLORS[note.color] || NOTE_COLORS.zinc
                  return (
                    <div key={note.id} className={`bg-zinc-900 border rounded-xl p-4 flex flex-col justify-between ${colorStyle.border}`}>
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${colorStyle.dot}`} />
                            <h3 className="font-semibold text-zinc-100">{note.title}</h3>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => convertNoteToTask(note)}
                              title="Convertir en trabajo para hoy"
                              className="p-1.5 text-zinc-400 hover:text-blue-400 rounded-lg"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => togglePinNote(note)}
                              title="Fijar arriba"
                              className={`p-1.5 rounded-lg ${note.is_pinned ? 'text-amber-400 bg-amber-950/40' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                              <Pin className="w-4 h-4" />
                            </button>
                            <button onClick={() => openNoteModal(note)} className="p-1.5 text-zinc-500 hover:text-zinc-200 rounded-lg">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteNote(note.id)} className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-zinc-400 whitespace-pre-line">{note.content}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal Trabajo */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5 my-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">{editingTask ? 'Editar Trabajo' : 'Nuevo Trabajo'}</h3>
              <button onClick={() => setIsTaskModalOpen(false)}><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            <form onSubmit={saveTask} className="space-y-3">
              <input
                type="text" required placeholder="Título del trabajo"
                value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
              />
              <textarea
                rows="2" placeholder="Detalles, cliente, observaciones..."
                value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text" placeholder="Categoría"
                  value={taskForm.category} onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs"
                />
                <select
                  value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs"
                >
                  <option value="alta">Prioridad Alta</option>
                  <option value="media">Prioridad Media</option>
                  <option value="baja">Prioridad Baja</option>
                </select>
                <select
                  value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en_curso">En curso</option>
                  <option value="faltante">Faltante</option>
                  <option value="completado">Completado</option>
                </select>
              </div>

              {taskForm.status === 'faltante' && (
                <input
                  type="text"
                  placeholder="Motivo del faltante (ej: Falta respuesta del cliente)"
                  value={taskForm.blocker_reason}
                  onChange={(e) => setTaskForm({ ...taskForm, blocker_reason: e.target.value })}
                  className="w-full bg-amber-950/30 border border-amber-800/70 rounded-lg px-3 py-2 text-xs text-amber-200 placeholder-amber-500/70"
                />
              )}

              {/* Subtareas en el formulario */}
              <div className="border-t border-zinc-800 pt-3">
                <label className="text-xs text-zinc-400 block mb-1.5">Subtareas / Pasos</label>
                <div className="flex gap-1.5 mb-2">
                  <input
                    type="text"
                    placeholder="Agregar paso..."
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtaskToForm())}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={addSubtaskToForm}
                    className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-xs"
                  >
                    Añadir
                  </button>
                </div>
                {taskForm.subtasks.length > 0 && (
                  <ul className="space-y-1 max-h-28 overflow-y-auto">
                    {taskForm.subtasks.map(sub => (
                      <li key={sub.id} className="flex items-center justify-between text-xs bg-zinc-950 px-2.5 py-1 rounded">
                        <span className="truncate">{sub.text}</span>
                        <button type="button" onClick={() => removeSubtaskFromForm(sub.id)} className="text-zinc-500 hover:text-red-400 ml-2">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium">
                Guardar Trabajo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nota */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">{editingNote ? 'Editar Nota' : 'Nueva Nota'}</h3>
              <button onClick={() => setIsNoteModalOpen(false)}><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            <form onSubmit={saveNote} className="space-y-3">
              <input
                type="text" required placeholder="Título de la anotación"
                value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
              />
              <textarea
                rows="5" required placeholder="Escribí acá tus apuntes, accesos, ideas..."
                value={noteForm.content} onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Etiqueta:</span>
                {Object.entries(NOTE_COLORS).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setNoteForm({ ...noteForm, color: key })}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${
                      noteForm.color === key ? 'border-zinc-200 bg-zinc-800 text-white' : 'border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </button>
                ))}
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium">
                Guardar Nota
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}