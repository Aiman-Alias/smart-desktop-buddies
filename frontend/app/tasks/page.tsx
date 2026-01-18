"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, CheckSquare, Clock, Trash2, Edit, Loader2, Info, AlertCircle, Calendar as CalendarIcon } from "lucide-react"
import { api, Task as ApiTask } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { NavigationBar } from "@/components/navigation-bar"
import { useToast } from "@/hooks/use-toast"

interface TaskDisplay {
  id: string
  title: string
  completed: boolean
  createdAt: string
  priority: "low" | "medium" | "high"
  category: string
  difficulty?: number
  dueDate?: string | null
}

export default function TaskManager() {
  const [tasks, setTasks] = useState<TaskDisplay[]>([])
  const [newTask, setNewTask] = useState("")
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium")
  const [newTaskDifficulty, setNewTaskDifficulty] = useState<number>(3)
  const [newTaskDeadlineDate, setNewTaskDeadlineDate] = useState<Date | undefined>(undefined)
  const [newTaskDeadlineTime, setNewTaskDeadlineTime] = useState<string>("")
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "deadline">("all")
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high">("medium")
  const [editDifficulty, setEditDifficulty] = useState<number>(3)
  const [editDeadlineDate, setEditDeadlineDate] = useState<Date | undefined>(undefined)
  const [editDeadlineTime, setEditDeadlineTime] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showClearAllDialog, setShowClearAllDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showClearCompletedDialog, setShowClearCompletedDialog] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  // Extract difficulty from description (format: "DIFFICULTY:3|rest of description" or just "DIFFICULTY:3")
  const extractDifficultyFromDescription = (description: string): { difficulty: number | null; cleanDescription: string } => {
    if (!description) return { difficulty: null, cleanDescription: '' }
    
    const difficultyMatch = description.match(/^DIFFICULTY:(\d+)(?:\|(.+))?$/)
    if (difficultyMatch) {
      const difficulty = parseInt(difficultyMatch[1], 10)
      const cleanDescription = difficultyMatch[2] || ''
      return { difficulty, cleanDescription }
    }
    
    return { difficulty: null, cleanDescription: description }
  }

  // Convert API task to display format
  const convertToDisplay = (task: ApiTask): TaskDisplay => {
    const { difficulty, cleanDescription } = extractDifficultyFromDescription(task.description || '')
    
    return {
      id: task.id.toString(),
      title: task.title,
      completed: task.status === 'completed',
      createdAt: task.created_at,
      priority: task.priority,
      category: 'General', // Backend doesn't have category, using default
      difficulty: difficulty || undefined,
      dueDate: task.due_date || undefined,
    }
  }

  // Load tasks from API
  useEffect(() => {
    if (!user) return

    const loadTasks = async () => {
      try {
        setLoading(true)
        setError(null)
        const apiTasks = await api.getTasks()
        const displayTasks = apiTasks.map(convertToDisplay)
        setTasks(sortTasks(displayTasks))
      } catch (err) {
        console.error('Failed to load tasks:', err)
        setError(err instanceof Error ? err.message : 'Failed to load tasks')
      } finally {
        setLoading(false)
      }
    }

    loadTasks()
  }, [user])

  const addTask = async () => {
    if (!newTask.trim() || !user) return

    // Validate that deadline is set (required)
    if (!newTaskDeadlineDate) {
      setError('Deadline date is required. Please select a date for the task deadline.')
      return
    }
    
    // Validate that deadline time is set (required)
    if (!newTaskDeadlineTime || !newTaskDeadlineTime.trim()) {
      setError('Deadline time is required. Please select a time for the task deadline.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      
      // Format description with difficulty: "DIFFICULTY:3" or "DIFFICULTY:3|description"
      const description = `DIFFICULTY:${newTaskDifficulty}`
      
      // Format deadline date and time (required)
      let dueDate: string | undefined = undefined
      if (newTaskDeadlineDate) {
        try {
          // Ensure we have a valid Date object
          let deadlineDateTime: Date
          if (newTaskDeadlineDate instanceof Date) {
            deadlineDateTime = new Date(newTaskDeadlineDate)
          } else {
            deadlineDateTime = new Date(newTaskDeadlineDate)
          }
          
          // Validate the date
          if (isNaN(deadlineDateTime.getTime())) {
            throw new Error('Invalid date selected')
          }
          
          // Set time if provided
          if (newTaskDeadlineTime && newTaskDeadlineTime.trim()) {
            const timeParts = newTaskDeadlineTime.split(':')
            if (timeParts.length >= 2) {
              const hours = parseInt(timeParts[0], 10)
              const minutes = parseInt(timeParts[1], 10)
              if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                deadlineDateTime.setHours(hours, minutes, 0, 0)
              } else {
                deadlineDateTime.setHours(23, 59, 59, 999) // Default to end of day if time format is invalid
              }
            } else {
              deadlineDateTime.setHours(23, 59, 59, 999) // Default to end of day if time format is invalid
            }
          } else {
            deadlineDateTime.setHours(23, 59, 59, 999) // Default to end of day if no time specified
          }
          
          // Format as ISO string for backend
          dueDate = deadlineDateTime.toISOString()
          console.log('Formatted deadline:', dueDate)
        } catch (dateError) {
          console.error('Error formatting deadline date:', dateError)
          setError('Invalid deadline date or time format. Please try again.')
          setSaving(false)
          return
        }
      }
      
      // Log the data being sent for debugging
      console.log('Creating task with:', {
        title: newTask.trim(),
        description,
        priority: newTaskPriority,
        dueDate: dueDate || null
      })
      
      const apiTask = await api.createTask(newTask.trim(), description, newTaskPriority, dueDate || undefined)
      const displayTask = convertToDisplay(apiTask)
      
      // Add new task and sort
      const updatedTasks = [...tasks, displayTask]
      setTasks(sortTasks(updatedTasks))
      
      // Reset form
      setNewTask("")
      setNewTaskPriority("medium")
      setNewTaskDifficulty(3)
      setNewTaskDeadlineDate(undefined)
      setNewTaskDeadlineTime("")
    } catch (err) {
      console.error('Failed to create task:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create task'
      setError(errorMessage)
      // Log more details for debugging
      console.error('Task creation error details:', {
        title: newTask.trim(),
        priority: newTaskPriority,
        difficulty: newTaskDifficulty,
        deadlineDate: newTaskDeadlineDate,
        deadlineTime: newTaskDeadlineTime,
        error: err
      })
    } finally {
      setSaving(false)
    }
  }

  // Check if task deadline is exceeded
  const isDeadlineExceeded = (dueDate: string | null | undefined): boolean => {
    if (!dueDate) return false
    const deadline = new Date(dueDate)
    const now = new Date()
    return deadline < now && !isNaN(deadline.getTime())
  }

  // Sort tasks: first by priority (High > Medium > Low), then by difficulty (lower = higher in list)
  // If filter is "deadline", sort by deadline date (closer deadlines first)
  const sortTasks = (tasksToSort: TaskDisplay[]): TaskDisplay[] => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    
    return [...tasksToSort].sort((a, b) => {
      // If filtering by deadline, sort by deadline date first (closer deadlines = higher in list)
      if (filter === "deadline") {
        if (a.dueDate && b.dueDate) {
          const dateA = new Date(a.dueDate).getTime()
          const dateB = new Date(b.dueDate).getTime()
          if (dateA !== dateB) return dateA - dateB
        } else if (a.dueDate && !b.dueDate) return -1
        else if (!a.dueDate && b.dueDate) return 1
      }
      
      // First sort by priority
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      
      // If same priority, sort by difficulty (lower difficulty = higher in list)
      const difficultyA = a.difficulty || 3 // Default to 3 if no difficulty
      const difficultyB = b.difficulty || 3
      return difficultyA - difficultyB
    })
  }

  const toggleTask = async (id: string) => {
    if (!user) return

    try {
      setError(null)
      const taskId = parseInt(id)
      const currentTask = tasks.find(t => t.id === id)
      if (!currentTask) return

      const newStatus = currentTask.completed ? 'todo' : 'completed'
      const apiTask = await api.updateTask(taskId, undefined, undefined, undefined, newStatus)
      const displayTask = convertToDisplay(apiTask)
      
      const updatedTasks = tasks.map(task => task.id === id ? displayTask : task)
      setTasks(sortTasks(updatedTasks))
    } catch (err) {
      console.error('Failed to update task:', err)
      setError(err instanceof Error ? err.message : 'Failed to update task')
    }
  }

  const handleDeleteClick = (id: string) => {
    setTaskToDelete(id)
    setShowDeleteDialog(true)
  }

  const deleteTask = async (id: string) => {
    if (!user) return

    try {
      setError(null)
      const taskId = parseInt(id)
      const taskTitle = tasks.find(t => t.id === id)?.title || "Task"
      await api.deleteTask(taskId)
      setTasks(tasks.filter(task => task.id !== id))
      setShowDeleteDialog(false)
      setTaskToDelete(null)
      toast({
        title: "Task deleted",
        description: `"${taskTitle}" has been deleted successfully.`,
      })
    } catch (err) {
      console.error('Failed to delete task:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete task'
      setError(errorMessage)
      setShowDeleteDialog(false)
      setTaskToDelete(null)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const startEditing = (task: TaskDisplay) => {
    setEditingTask(task.id)
    setEditTitle(task.title)
    setEditPriority(task.priority)
    setEditDifficulty(task.difficulty || 3)
    
    // Parse deadline date and time
    if (task.dueDate) {
      const deadlineDate = new Date(task.dueDate)
      setEditDeadlineDate(deadlineDate)
      const hours = deadlineDate.getHours().toString().padStart(2, '0')
      const minutes = deadlineDate.getMinutes().toString().padStart(2, '0')
      setEditDeadlineTime(`${hours}:${minutes}`)
    } else {
      setEditDeadlineDate(undefined)
      setEditDeadlineTime("")
    }
  }

  const saveEdit = async (id: string) => {
    if (!editTitle.trim() || !user) return

    // Validate deadline if provided (deadline is optional when editing)
    if (editDeadlineDate && !editDeadlineTime.trim()) {
      setError('Deadline time is required when a date is selected. Clear the date if you want to remove the deadline.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      const taskId = parseInt(id)
      
      // Format description with difficulty: "DIFFICULTY:3"
      const description = `DIFFICULTY:${editDifficulty}`
      
      // Format deadline date and time
      let dueDate: string | undefined = undefined
      if (editDeadlineDate) {
        try {
          const deadlineDateTime = new Date(editDeadlineDate)
          
          if (isNaN(deadlineDateTime.getTime())) {
            throw new Error('Invalid date selected')
          }
          
          // Set time if provided
          if (editDeadlineTime && editDeadlineTime.trim()) {
            const timeParts = editDeadlineTime.split(':')
            if (timeParts.length >= 2) {
              const hours = parseInt(timeParts[0], 10)
              const minutes = parseInt(timeParts[1], 10)
              if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                deadlineDateTime.setHours(hours, minutes, 0, 0)
              } else {
                deadlineDateTime.setHours(23, 59, 59, 999)
              }
            } else {
              deadlineDateTime.setHours(23, 59, 59, 999)
            }
          } else {
            deadlineDateTime.setHours(23, 59, 59, 999)
          }
          
          dueDate = deadlineDateTime.toISOString()
        } catch (dateError) {
          console.error('Error formatting deadline date:', dateError)
          setError('Invalid deadline date or time format. Please try again.')
          setSaving(false)
          return
        }
      }
      
      const apiTask = await api.updateTask(
        taskId,
        editTitle.trim(),
        description,
        editPriority,
        undefined, // status - keep current status
        dueDate || null
      )
      const displayTask = convertToDisplay(apiTask)
      
      const updatedTasks = tasks.map(task => task.id === id ? displayTask : task)
      setTasks(sortTasks(updatedTasks))
      setEditingTask(null)
      setEditTitle("")
      setEditPriority("medium")
      setEditDifficulty(3)
      setEditDeadlineDate(undefined)
      setEditDeadlineTime("")
      
      toast({
        title: "Task updated",
        description: "Task has been updated successfully.",
      })
    } catch (err) {
      console.error('Failed to update task:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to update task'
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setEditingTask(null)
    setEditTitle("")
    setEditPriority("medium")
    setEditDifficulty(3)
    setEditDeadlineDate(undefined)
    setEditDeadlineTime("")
  }

  const filteredTasks = sortTasks(tasks.filter((task) => {
    if (filter === "pending") return !task.completed
    if (filter === "completed") return task.completed
    if (filter === "deadline") return task.dueDate !== null && task.dueDate !== undefined
    return true
  }))

  const completedCount = tasks.filter((task) => task.completed).length
  const pendingCount = tasks.filter((task) => !task.completed).length
  const exceededDeadlineCount = tasks.filter((task) => !task.completed && isDeadlineExceeded(task.dueDate)).length

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <NavigationBar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column - Stats */}
          <div className="space-y-6">
            {/* Task Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckSquare className="h-5 w-5 text-green-500" />
                  <span>Task Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{tasks.length}</div>
                  <p className="text-sm text-gray-600">Total Tasks</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{completedCount}</div>
                  <p className="text-sm text-gray-600">Completed</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">{pendingCount}</div>
                  <p className="text-sm text-gray-600">Pending</p>
                </div>
                {tasks.length > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round((completedCount / tasks.length) * 100)}%
                    </div>
                    <p className="text-sm text-gray-600">Completion Rate</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Filter Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span>Filter Tasks</span>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
                          <Info className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="right" 
                        className="max-w-xs p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
                      >
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">
                              Filter Options:
                            </h4>
                            <ul className="text-xs space-y-2 text-gray-700 dark:text-gray-300">
                              <li>
                                <strong className="text-gray-900 dark:text-gray-100">All Tasks:</strong> Shows all tasks regardless of status
                              </li>
                              <li>
                                <strong className="text-gray-900 dark:text-gray-100">Pending:</strong> Shows only incomplete/active tasks
                              </li>
                              <li>
                                <strong className="text-gray-900 dark:text-gray-100">Completed:</strong> Shows only finished tasks
                              </li>
                              <li>
                                <strong className="text-gray-900 dark:text-gray-100">By Deadline:</strong> Sort the tasks by the closest deadline. The number indicates the number of tasks exceeded deadline
                              </li>
                            </ul>
                          </div>
                          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              💡 <strong>Tip:</strong> Use filters to focus on specific types of tasks and manage your workload more effectively!
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant={filter === "all" ? "default" : "outline"}
                  onClick={() => setFilter("all")}
                  className={`w-full justify-start ${
                    filter === "all"
                      ? "dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white"
                      : "dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  All Tasks ({tasks.length})
                </Button>
                <Button
                  variant={filter === "pending" ? "default" : "outline"}
                  onClick={() => setFilter("pending")}
                  className={`w-full justify-start ${
                    filter === "pending"
                      ? "dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white"
                      : "dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  Pending ({pendingCount})
                </Button>
                <Button
                  variant={filter === "completed" ? "default" : "outline"}
                  onClick={() => setFilter("completed")}
                  className={`w-full justify-start ${
                    filter === "completed"
                      ? "dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white"
                      : "dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  Completed ({completedCount})
                </Button>
                <Button
                  variant={filter === "deadline" ? "default" : "outline"}
                  onClick={() => setFilter("deadline")}
                  className={`w-full justify-start ${
                    filter === "deadline"
                      ? "dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white"
                      : "dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  By Deadline ({exceededDeadlineCount})
                </Button>
              </CardContent>
            </Card>

            {/* Productivity Tips */}
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 dark:from-purple-900/20 dark:to-pink-900/20 dark:border-purple-800/30">
              <CardHeader>
                <CardTitle className="text-purple-800 dark:text-purple-300">💡 Productivity Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-purple-700 dark:text-purple-300">
                  <p>• Break large tasks into smaller ones</p>
                  <p>• Use the Pomodoro Technique for focus</p>
                  <p>• Prioritize tasks by importance</p>
                  <p>• Set realistic daily goals</p>
                  <p>• Celebrate completed tasks!</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Task List */}
          <div className="lg:col-span-3 space-y-6">
            {/* Add New Task */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Plus className="h-5 w-5 text-blue-500" />
                  <span>Add New Task</span>
                </CardTitle>
                <CardDescription>What would you like to accomplish today?</CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                    {error}
                  </div>
                )}
                <div className="space-y-4">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Enter a new task..."
                      value={newTask}
                      onChange={(e) => setNewTask(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && !saving && addTask()}
                      className="flex-1"
                      disabled={saving || loading}
                    />
                    <Button 
                      onClick={addTask} 
                      disabled={!newTask.trim() || !newTaskDeadlineDate || !newTaskDeadlineTime || saving || loading}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Add Task
                    </Button>
                  </div>
                  
                  {/* Priority Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Priority</label>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant={newTaskPriority === "high" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNewTaskPriority("high")}
                        className={newTaskPriority === "high" ? "bg-red-600 hover:bg-red-700" : ""}
                      >
                        High
                      </Button>
                      <Button
                        type="button"
                        variant={newTaskPriority === "medium" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNewTaskPriority("medium")}
                        className={newTaskPriority === "medium" ? "bg-yellow-400 hover:bg-yellow-500 text-gray-900 dark:bg-yellow-500 dark:hover:bg-yellow-600 dark:text-gray-900" : ""}
                      >
                        Medium
                      </Button>
                      <Button
                        type="button"
                        variant={newTaskPriority === "low" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNewTaskPriority("low")}
                        className={newTaskPriority === "low" ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        Low
                      </Button>
                    </div>
                  </div>
                  
                  {/* Difficulty Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Difficulty (1-5)</label>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">1 = Easy</span>
                        <span className="text-xs text-red-600 dark:text-red-400 font-medium">5 = Very Difficult</span>
                      </div>
                      <div className="flex space-x-2">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <Button
                            key={level}
                            type="button"
                            variant={newTaskDifficulty === level ? "default" : "outline"}
                            size="sm"
                            onClick={() => setNewTaskDifficulty(level)}
                            className={`min-w-[50px] ${
                              newTaskDifficulty === level 
                                ? "bg-blue-600 hover:bg-blue-700" 
                                : "hover:bg-blue-100"
                            }`}
                          >
                            {level}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Deadline Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Deadline <span className="text-red-500 dark:text-red-400">*</span>
                    </label>
                    <div className="flex space-x-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`flex-1 justify-start text-left font-normal ${
                              !newTaskDeadlineDate ? 'border-red-300' : ''
                            }`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newTaskDeadlineDate ? (
                              newTaskDeadlineDate.toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            ) : (
                              <span className="text-gray-400">Select date *</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={newTaskDeadlineDate}
                            onSelect={setNewTaskDeadlineDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Input
                        type="time"
                        value={newTaskDeadlineTime}
                        onChange={(e) => setNewTaskDeadlineTime(e.target.value)}
                        placeholder="Time *"
                        className={`w-32 ${!newTaskDeadlineTime ? 'border-red-300' : ''}`}
                        required
                      />
                    </div>
                    {!newTaskDeadlineDate && (
                      <p className="text-xs text-red-500">Deadline date is required</p>
                    )}
                    {newTaskDeadlineDate && !newTaskDeadlineTime && (
                      <p className="text-xs text-red-500">Deadline time is required</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Task List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <span>Your Tasks</span>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
                            <Info className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent 
                          side="bottom" 
                          className="max-w-sm p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
                        >
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">
                                How Tasks Are Arranged
                              </h4>
                              <p className="text-xs text-gray-700 dark:text-gray-300">
                                Tasks are automatically sorted by <strong className="text-gray-900 dark:text-gray-100">priority first</strong> (High → Medium → Low), 
                                then by <strong className="text-gray-900 dark:text-gray-100">difficulty</strong> within the same priority level. Easier tasks appear 
                                higher in each priority group.
                              </p>
                            </div>
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                💡 <strong>Pro Tip:</strong> Starting with easier tasks creates a "snowball effect" - 
                                completing simple tasks builds momentum and motivation, making it easier to tackle 
                                more challenging tasks later!
                              </p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                  <Badge variant="outline">
                    {filteredTasks.length} {filter === "all" ? "total" : filter}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 mx-auto mb-4 text-gray-300 animate-spin" />
                    <p className="text-gray-500">Loading tasks...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTasks.length === 0 ? (
                      <div className="text-center py-12">
                        <CheckSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500 mb-2">
                          {filter === "all"
                            ? "No tasks yet. Add your first task above!"
                            : filter === "pending"
                              ? "No pending tasks. Great job!"
                              : filter === "completed"
                              ? "No completed tasks yet. Keep going!"
                              : "No tasks with deadlines yet."}
                        </p>
                      </div>
                    ) : (
                    filteredTasks.map((task) => {
                      const deadlineExceeded = !task.completed && isDeadlineExceeded(task.dueDate)
                      return (
                      <div
                        key={task.id}
                        className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors ${
                          deadlineExceeded
                            ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800/30"
                            : task.completed
                            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30"
                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <Checkbox checked={task.completed} onCheckedChange={() => toggleTask(task.id)} />

                        <div className="flex-1 min-w-0">
                          {editingTask === task.id ? (
                            <div className="space-y-4">
                              {error && (
                                <div className="p-2 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
                                  {error}
                                </div>
                              )}
                              
                              {/* Title */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Task Title</label>
                                <Input
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  placeholder="Enter task title..."
                                  className="w-full"
                                  autoFocus
                                />
                              </div>
                              
                              {/* Priority */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                                <div className="flex space-x-2">
                                  <Button
                                    type="button"
                                    variant={editPriority === "high" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setEditPriority("high")}
                                    className={editPriority === "high" ? "bg-red-600 hover:bg-red-700" : ""}
                                  >
                                    High
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={editPriority === "medium" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setEditPriority("medium")}
                                    className={editPriority === "medium" ? "bg-yellow-400 hover:bg-yellow-500 text-gray-900 dark:bg-yellow-500 dark:hover:bg-yellow-600 dark:text-gray-900" : ""}
                                  >
                                    Medium
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={editPriority === "low" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setEditPriority("low")}
                                    className={editPriority === "low" ? "bg-green-600 hover:bg-green-700" : ""}
                                  >
                                    Low
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Difficulty */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Difficulty (1-5)</label>
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">1 = Easy</span>
                                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">5 = Very Difficult</span>
                                  </div>
                                  <div className="flex space-x-2">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                      <Button
                                        key={level}
                                        type="button"
                                        variant={editDifficulty === level ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setEditDifficulty(level)}
                                        className={`min-w-[50px] ${
                                          editDifficulty === level 
                                            ? "bg-blue-600 hover:bg-blue-700" 
                                            : "hover:bg-blue-100"
                                        }`}
                                      >
                                        {level}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Deadline */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Deadline
                                </label>
                                <div className="flex space-x-2">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className="flex-1 justify-start text-left font-normal"
                                      >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {editDeadlineDate ? (
                                          editDeadlineDate.toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                          })
                                        ) : (
                                          <span className="text-gray-400">Select date (optional)</span>
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar
                                        mode="single"
                                        selected={editDeadlineDate}
                                        onSelect={setEditDeadlineDate}
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                  <Input
                                    type="time"
                                    value={editDeadlineTime}
                                    onChange={(e) => setEditDeadlineTime(e.target.value)}
                                    placeholder="Time"
                                    className="w-32"
                                    disabled={!editDeadlineDate}
                                  />
                                  {editDeadlineDate && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditDeadlineDate(undefined)
                                        setEditDeadlineTime("")
                                      }}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      Clear
                                    </Button>
                                  )}
                                </div>
                                {editDeadlineDate && !editDeadlineTime && (
                                  <p className="text-xs text-red-500">Time is required when date is selected</p>
                                )}
                              </div>
                              
                              {/* Action Buttons */}
                              <div className="flex space-x-2 pt-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => saveEdit(task.id)}
                                  disabled={saving || !editTitle.trim()}
                                >
                                  {saving ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={cancelEdit}
                                  disabled={saving}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className={`font-medium ${task.completed ? "line-through text-gray-500" : ""}`}>
                                {task.title}
                              </p>
                              <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
                                <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                                {task.difficulty && (
                                  <Badge variant="outline" className="text-xs">
                                    Difficulty: {task.difficulty}/5
                                  </Badge>
                                )}
                                {task.dueDate && (
                                  <Badge variant="outline" className="text-xs">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {new Date(task.dueDate).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })} at {new Date(task.dueDate).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </Badge>
                                )}
                                {deadlineExceeded && (
                                  <Badge variant="destructive" className="text-xs">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Exceeding deadline
                                  </Badge>
                                )}
                                <span className="text-xs text-gray-500 flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Created: {new Date(task.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {editingTask !== task.id && (
                          <div className="flex space-x-1">
                            <Button size="sm" variant="ghost" onClick={() => startEditing(task)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteClick(task.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      )
                    })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            {tasks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!user) return
                        try {
                          const pendingTasks = tasks.filter(t => !t.completed)
                          await Promise.all(pendingTasks.map(t => api.updateTask(parseInt(t.id), undefined, undefined, undefined, 'completed')))
                          const updatedTasks = tasks.map(t => ({ ...t, completed: true }))
                          setTasks(sortTasks(updatedTasks))
                        } catch (err) {
                          console.error('Failed to mark all complete:', err)
                          setError(err instanceof Error ? err.message : 'Failed to mark all complete')
                        }
                      }}
                    >
                      Mark All Complete
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!user) return
                        try {
                          const completedTasks = tasks.filter(t => t.completed)
                          await Promise.all(completedTasks.map(t => api.updateTask(parseInt(t.id), undefined, undefined, undefined, 'todo')))
                          const updatedTasks = tasks.map(t => ({ ...t, completed: false }))
                          setTasks(sortTasks(updatedTasks))
                        } catch (err) {
                          console.error('Failed to mark all pending:', err)
                          setError(err instanceof Error ? err.message : 'Failed to mark all pending')
                        }
                      }}
                    >
                      Mark All Pending
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!user) return
                        setShowClearCompletedDialog(true)
                      }}
                    >
                      Clear Completed
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!user) return
                        setShowClearAllDialog(true)
                      }}
                    >
                      Clear All Tasks
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Delete Single Task Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone. The task will be permanently removed.
              {taskToDelete && (
                <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                  <strong>Task:</strong> {tasks.find(t => t.id === taskToDelete)?.title}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false)
              setTaskToDelete(null)
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (taskToDelete) {
                  deleteTask(taskToDelete)
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Completed Tasks Confirmation Dialog */}
      <AlertDialog open={showClearCompletedDialog} onOpenChange={setShowClearCompletedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Completed Tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all completed tasks? This action cannot be undone. All {tasks.filter(t => t.completed).length} completed task{tasks.filter(t => t.completed).length !== 1 ? 's' : ''} will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowClearCompletedDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!user) return
                try {
                  const completedTasks = tasks.filter(t => t.completed)
                  const completedCount = completedTasks.length
                  await Promise.all(completedTasks.map(t => api.deleteTask(parseInt(t.id))))
                  setTasks(sortTasks(tasks.filter(t => !t.completed)))
                  setShowClearCompletedDialog(false)
                  toast({
                    title: "Completed tasks cleared",
                    description: `${completedCount} completed task${completedCount !== 1 ? 's' : ''} ${completedCount !== 1 ? 'have' : 'has'} been deleted successfully.`,
                  })
                } catch (err) {
                  console.error('Failed to clear completed:', err)
                  const errorMessage = err instanceof Error ? err.message : 'Failed to clear completed tasks'
                  setError(errorMessage)
                  setShowClearCompletedDialog(false)
                  toast({
                    title: "Error",
                    description: errorMessage,
                    variant: "destructive",
                  })
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Clear Completed Tasks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Tasks Confirmation Dialog */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all tasks? This action cannot be undone. All {tasks.length} task{tasks.length !== 1 ? 's' : ''} will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!user) return
                try {
                  await Promise.all(tasks.map(t => api.deleteTask(parseInt(t.id))))
                  setTasks([])
                  setShowClearAllDialog(false)
                  toast({
                    title: "All tasks deleted",
                    description: `All ${tasks.length} task${tasks.length !== 1 ? 's' : ''} have been deleted successfully.`,
                  })
                } catch (err) {
                  console.error('Failed to clear all tasks:', err)
                  const errorMessage = err instanceof Error ? err.message : 'Failed to clear all tasks'
                  setError(errorMessage)
                  setShowClearAllDialog(false)
                  toast({
                    title: "Error",
                    description: errorMessage,
                    variant: "destructive",
                  })
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete All Tasks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
