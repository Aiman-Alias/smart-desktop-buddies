"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Timer,
  CheckSquare,
  Calendar,
  BarChart3,
  Play,
  Pause,
  RotateCcw,
  RefreshCw,
  Loader2,
  MessageCircle,
  AlertCircle,
  Clock,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth"
import { api, Quote, CalendarEvent } from "@/lib/api"
import { NotificationService } from "@/lib/notifications"
import { NavigationBar } from "@/components/navigation-bar"
import { useToast } from "@/hooks/use-toast"
import { useTheme } from "next-themes"

interface Task {
  id: string
  title: string
  completed: boolean
  priority: "low" | "medium" | "high"
  difficulty?: number
  dueDate?: string | null
}

export default function Dashboard() {
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60) // Current timer in seconds
  const [isRunning, setIsRunning] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const [isRest, setIsRest] = useState(false) // Long rest period after 3 sessions
  const [focusDuration, setFocusDuration] = useState(25) // Focus duration in minutes (25-60, 5-min increments)
  const [breakDuration, setBreakDuration] = useState(5) // Break duration in minutes (5-10, 1-min increments)
  const [sessionCount, setSessionCount] = useState(0) // Track consecutive focus sessions
  const [initialFocusTime, setInitialFocusTime] = useState(25 * 60) // Track initial focus time when session starts
  const [totalFocusTime, setTotalFocusTime] = useState(0) // Total focus time in seconds
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [currentFocusSessionId, setCurrentFocusSessionId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsPage, setEventsPage] = useState(1)
  const [eventsTotalPages, setEventsTotalPages] = useState(1)
  const [eventsHasNext, setEventsHasNext] = useState(false)
  const [eventsHasPrevious, setEventsHasPrevious] = useState(false)
  const [calendarConnections, setCalendarConnections] = useState<any[]>([])
  const [buddyName, setBuddyName] = useState("Buddy")
  const [buddyAppearance, setBuddyAppearance] = useState("owl")
  const router = useRouter()
  const { user } = useAuth()
  const quoteFetchedForUserIdRef = useRef<number | null>(null)

  // Get buddy emoji based on appearance
  const getBuddyEmoji = (appearance: string) => {
    switch (appearance) {
      case "cat":
        return "🐱"
      case "dog":
        return "🐶"
      case "robot":
        return "🤖"
      case "owl":
        return "🦉"
      case "panda":
        return "🐼"
      case "wolf":
        return "🐺"
      default:
        return "🦉"
    }
  }

  // Convert focus duration to seconds
  const getFocusDurationSeconds = () => focusDuration * 60

  // Fetch motivational quote
  const fetchQuote = async () => {
    setQuoteLoading(true)
    setQuoteError(null)
    try {
      const quoteData = await api.getZenQuote('random')
      if (quoteData.text && quoteData.author) {
        setQuote({
          text: quoteData.text,
          author: quoteData.author,
          html: quoteData.html
        })
      }
    } catch (error) {
      console.error('Failed to fetch quote:', error)
      setQuoteError(error instanceof Error ? error.message : 'Failed to load quote')
      // Fallback to default quote if API fails
      setQuote({
        text: "The future depends on what you do today. Every small step forward is progress worth celebrating!",
        author: "Your Smart Buddy"
      })
    } finally {
      setQuoteLoading(false)
    }
  }

  // Load total focus time from backend
  const loadTotalFocusTime = async () => {
    if (!user) return
    try {
      // Get analytics data for today
      const result = await api.getAnalytics(1) // Get last 1 day
      const today = new Date().toDateString()
      
      // Find today's data
      const todayData = result.daily_data.find((day: any) => {
        const dayDate = new Date(day.date).toDateString()
        return dayDate === today
      })
      
      if (todayData && todayData.focusTime) {
        // Convert minutes to seconds
        setTotalFocusTime(todayData.focusTime * 60)
      } else {
        setTotalFocusTime(0)
      }
    } catch (err) {
      console.error('Failed to load focus time:', err)
      // Fallback to localStorage
      const savedFocusTime = localStorage.getItem('smartBuddyTotalFocusTime')
      if (savedFocusTime) {
        const focusData = JSON.parse(savedFocusTime)
        const today = new Date().toDateString()
        if (focusData.date === today) {
          setTotalFocusTime(focusData.seconds || 0)
        }
      }
    }
  }

  // Load total focus time from localStorage on mount (fallback)
  useEffect(() => {
    const savedFocusTime = localStorage.getItem('smartBuddyTotalFocusTime')
    if (savedFocusTime) {
      const focusData = JSON.parse(savedFocusTime)
      const today = new Date().toDateString()
      if (focusData.date === today) {
        setTotalFocusTime(focusData.seconds || 0)
      } else {
        // Reset for new day
        setTotalFocusTime(0)
        localStorage.setItem('smartBuddyTotalFocusTime', JSON.stringify({ date: today, seconds: 0 }))
      }
    }
    // Load from backend
    if (user) {
      loadTotalFocusTime()
    }
  }, [user])

  // Save total focus time to localStorage
  useEffect(() => {
    if (totalFocusTime > 0) {
      const today = new Date().toDateString()
      localStorage.setItem('smartBuddyTotalFocusTime', JSON.stringify({ date: today, seconds: totalFocusTime }))
    }
  }, [totalFocusTime])

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

  // Check if deadline is exceeded
  const isDeadlineExceeded = (dueDate: string | null | undefined): boolean => {
    if (!dueDate) return false
    const deadline = new Date(dueDate)
    const now = new Date()
    return deadline < now && !isNaN(deadline.getTime())
  }

  // Get priority color
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

  // Fetch tasks from API
  const fetchTasks = async () => {
    if (!user) return
    try {
      setTasksLoading(true)
      const apiTasks = await api.getTasks()
      // Convert to display format
      const displayTasks = apiTasks.map(task => {
        const { difficulty } = extractDifficultyFromDescription(task.description || '')
        return {
          id: task.id.toString(),
          title: task.title,
          completed: task.status === 'completed',
          priority: task.priority || 'medium',
          difficulty: difficulty || undefined,
          dueDate: task.due_date || undefined,
        }
      })
      
      // Sort tasks: prioritize exceeded deadline tasks first, then by priority and difficulty
      const sortedTasks = displayTasks.sort((a, b) => {
        const aExceeded = !a.completed && isDeadlineExceeded(a.dueDate)
        const bExceeded = !b.completed && isDeadlineExceeded(b.dueDate)
        
        // Exceeded deadline tasks come first
        if (aExceeded && !bExceeded) return -1
        if (!aExceeded && bExceeded) return 1
        
        // Then sort by priority
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
        if (priorityDiff !== 0) return priorityDiff
        
        // Then by difficulty (lower difficulty = higher in list)
        const difficultyA = a.difficulty || 3
        const difficultyB = b.difficulty || 3
        return difficultyA - difficultyB
      })
      
      setTasks(sortedTasks)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setTasksLoading(false)
    }
  }

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }

    // Load buddy preferences from user-specific localStorage
    const preferenceKey = `smartBuddyPreferences_${user.id}`
    const lastUserIdKey = "smartBuddyLastUserId"
    
    // Check if this is a different user - if so, use defaults
    const lastUserId = localStorage.getItem(lastUserIdKey)
    if (lastUserId && lastUserId !== String(user.id)) {
      // Different user - use defaults
      setBuddyName("Buddy")
      setBuddyAppearance("owl")
      setTheme("light")
      document.documentElement.classList.remove("dark")
      localStorage.setItem(lastUserIdKey, String(user.id))
      // Don't return - continue to fetch data
    } else {
      // Store current user ID
      localStorage.setItem(lastUserIdKey, String(user.id))
      
      const savedPreferences = localStorage.getItem(preferenceKey)
      if (savedPreferences) {
        try {
          const parsed = JSON.parse(savedPreferences)
          if (parsed.buddyName) {
            setBuddyName(parsed.buddyName)
          }
          if (parsed.buddyAppearance) {
            setBuddyAppearance(parsed.buddyAppearance)
          }
          // Restore user's saved theme
          if (parsed.theme) {
            setTheme(parsed.theme)
            // Also directly apply to DOM to ensure it takes effect
            const root = document.documentElement
            if (parsed.theme === "dark") {
              root.classList.add("dark")
            } else {
              root.classList.remove("dark")
            }
          }
        } catch (error) {
          console.error('Error loading buddy preferences:', error)
        }
      } else {
        // No preferences found - use defaults
        setBuddyName("Buddy")
        setBuddyAppearance("owl")
        setTheme("light")
        document.documentElement.classList.remove("dark")
      }
    }

    // Fetch tasks from API
    fetchTasks()

    // Fetch calendar connections and upcoming events (start at page 1)
    fetchCalendarConnections()
    fetchUpcomingEvents(1)

    // Fetch daily motivation quote only once per user session
    // Reset if user changed (logged out and back in)
    if (quoteFetchedForUserIdRef.current !== user.id) {
      quoteFetchedForUserIdRef.current = user.id
      fetchQuote()
    }

    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    // Refresh data every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchTasks()
    }, 30000)

    // Listen for preference changes (when settings are updated in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === preferenceKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          if (parsed.buddyName) {
            setBuddyName(parsed.buddyName)
          }
          if (parsed.buddyAppearance) {
            setBuddyAppearance(parsed.buddyAppearance)
          }
          if (parsed.theme) {
            setTheme(parsed.theme)
            const root = document.documentElement
            if (parsed.theme === "dark") {
              root.classList.add("dark")
            } else {
              root.classList.remove("dark")
            }
          }
        } catch (error) {
          console.error('Error loading buddy preferences:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Also check for changes in the same tab (polling)
    const preferenceCheckInterval = setInterval(() => {
      const currentPreferences = localStorage.getItem(preferenceKey)
      if (currentPreferences) {
        try {
          const parsed = JSON.parse(currentPreferences)
          if (parsed.buddyName && parsed.buddyName !== buddyName) {
            setBuddyName(parsed.buddyName)
          }
          if (parsed.buddyAppearance && parsed.buddyAppearance !== buddyAppearance) {
            setBuddyAppearance(parsed.buddyAppearance)
          }
          if (parsed.theme && parsed.theme !== theme) {
            setTheme(parsed.theme)
            const root = document.documentElement
            if (parsed.theme === "dark") {
              root.classList.add("dark")
            } else {
              root.classList.remove("dark")
            }
          }
        } catch (error) {
          console.error('Error loading buddy preferences:', error)
        }
      }
    }, 1000)

    return () => {
      clearInterval(timer)
      clearInterval(refreshInterval)
      clearInterval(preferenceCheckInterval)
      window.removeEventListener('storage', handleStorageChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router])

  const fetchCalendarConnections = async () => {
    if (!user) return
    try {
      const connections = await api.getCalendarConnections()
      setCalendarConnections(connections)
    } catch (error) {
      console.error('Failed to fetch calendar connections:', error)
      // Silently fail - don't show error to user, just leave empty
      setCalendarConnections([])
    }
  }

  const fetchUpcomingEvents = async (page: number = eventsPage) => {
    if (!user) return
    setEventsLoading(true)
    try {
      const result = await api.getUpcomingEvents(30, page, 5) // Get 5 events per page for next 30 days
      setUpcomingEvents(result.events)
      setEventsPage(result.page)
      setEventsTotalPages(result.total_pages)
      setEventsHasNext(result.has_next)
      setEventsHasPrevious(result.has_previous)
    } catch (error) {
      console.error('Failed to fetch upcoming events:', error)
      // Don't show error to user, just leave empty
      setUpcomingEvents([])
      setEventsPage(1)
      setEventsTotalPages(1)
      setEventsHasNext(false)
      setEventsHasPrevious(false)
    } finally {
      setEventsLoading(false)
    }
  }

  const handleNextPage = () => {
    if (eventsHasNext) {
      fetchUpcomingEvents(eventsPage + 1)
    }
  }

  const handlePreviousPage = () => {
    if (eventsHasPrevious) {
      fetchUpcomingEvents(eventsPage - 1)
    }
  }

  const handleRefreshEvents = async () => {
    if (!user) return
    setEventsLoading(true)
    try {
      // First sync all calendars, then fetch events
      const result = await api.syncCalendar()
      await fetchCalendarConnections()
      await fetchUpcomingEvents()
      
      // Show success toast
      const syncedCount = result?.synced || 0
      const createdCount = result?.created || 0
      const updatedCount = result?.updated || 0
      
      let description = `${syncedCount} events synced`
      if (createdCount > 0 || updatedCount > 0) {
        description += ` (${createdCount} new, ${updatedCount} updated)`
      }
      description += `. Events refreshed successfully.`
      
      toast({
        title: "Events Refreshed",
        description: description,
        variant: "default",
      })
    } catch (error) {
      console.error('Failed to refresh events:', error)
      // Still try to fetch events even if sync fails
      await fetchUpcomingEvents()
      
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : 'Failed to refresh calendar events. Please try again.',
        variant: "destructive",
      })
    } finally {
      setEventsLoading(false)
    }
  }

  const formatEventTime = (event: CalendarEvent) => {
    const startTime = new Date(event.start_time)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const eventDate = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate())
    
    if (event.all_day) {
      const diffDays = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays === 0) return 'Today (All Day)'
      if (diffDays === 1) return 'Tomorrow (All Day)'
      if (diffDays < 7) return startTime.toLocaleDateString('en-US', { weekday: 'long' }) + ' (All Day)'
      return startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' (All Day)'
    }
    
    const diffDays = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    
    if (diffDays === 0) return `Today, ${timeStr}`
    if (diffDays === 1) return `Tomorrow, ${timeStr}`
    if (diffDays < 7) {
      return startTime.toLocaleDateString('en-US', { weekday: 'long' }) + ', ' + timeStr
    }
    return startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + timeStr
  }

  const getEventColor = (provider: string) => {
    switch (provider) {
      case 'google':
        return 'bg-blue-500 dark:bg-blue-600'
      case 'outlook':
        return 'bg-green-500 dark:bg-green-600'
      case 'apple':
        return 'bg-purple-500 dark:bg-purple-600'
      default:
        return 'bg-gray-500 dark:bg-gray-600'
    }
  }

  // Track focus time when timer is running
  useEffect(() => {
    if (isRunning && !isBreak && !isRest && sessionStartTime === null) {
      const start = new Date()
      setSessionStartTime(start)
      setInitialFocusTime(pomodoroTime) // Store initial time when session starts
      // Create focus session in backend
      api.createFocusSession(start.toISOString(), 'medium').then(session => {
        setCurrentFocusSessionId(session.id)
      }).catch(err => {
        console.error('Failed to create focus session:', err)
      })
    } else if (!isRunning && sessionStartTime !== null && currentFocusSessionId && !isBreak && !isRest) {
      // Calculate elapsed time and add to total
      const end = new Date()
      const elapsed = Math.floor((end.getTime() - sessionStartTime.getTime()) / 1000)
      setTotalFocusTime(prev => prev + elapsed)
      
      // Update focus session in backend
      api.updateFocusSession(currentFocusSessionId, end.toISOString(), elapsed).then(() => {
        // Reload total focus time from backend after update
        loadTotalFocusTime()
      }).catch(err => {
        console.error('Failed to update focus session:', err)
      })
      
      setSessionStartTime(null)
      setCurrentFocusSessionId(null)
    }
  }, [isRunning, isBreak, isRest, sessionStartTime, currentFocusSessionId, pomodoroTime])

  // Function to complete timer early
  const completeTimerEarly = () => {
    if (!isRunning || isBreak || isRest || !sessionStartTime || !currentFocusSessionId) return
    
    setIsRunning(false)
    
    // Calculate elapsed time: initial time - remaining time
    const elapsed = initialFocusTime - pomodoroTime
    
    // Save elapsed time
    if (elapsed > 0) {
      setTotalFocusTime(prev => prev + elapsed)
      
      const end = new Date()
      // Update focus session in backend with elapsed time
      api.updateFocusSession(currentFocusSessionId, end.toISOString(), elapsed).then(() => {
        // Reload total focus time from backend after update
        loadTotalFocusTime()
      }).catch(err => {
        console.error('Failed to update focus session:', err)
      })
    }
    
    setSessionStartTime(null)
    setCurrentFocusSessionId(null)
    
    // Increment session count
    const newSessionCount = sessionCount + 1
    setSessionCount(newSessionCount)
    
    // Check if we need a long rest (after 3 sessions)
    if (newSessionCount >= 3) {
      // Long rest: 25 minutes, cannot be changed
      setPomodoroTime(25 * 60)
      setIsRest(true)
      setIsBreak(false)
      setSessionCount(0) // Reset session count
      NotificationService.showBreakReminder()
    } else {
      // Regular break
      setPomodoroTime(breakDuration * 60)
      setIsBreak(true)
      setIsRest(false)
      NotificationService.showBreakReminder()
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isRunning && pomodoroTime > 0) {
      interval = setInterval(() => {
        setPomodoroTime((time) => time - 1)
      }, 1000)
    } else if (pomodoroTime === 0) {
      setIsRunning(false)
      // Save focus time when work session ends
      if (!isBreak && !isRest && sessionStartTime && currentFocusSessionId) {
        const end = new Date()
        const elapsed = Math.floor((end.getTime() - sessionStartTime.getTime()) / 1000)
        setTotalFocusTime(prev => prev + elapsed)
        
        // Update focus session in backend
        api.updateFocusSession(currentFocusSessionId, end.toISOString(), elapsed).then(() => {
          // Reload total focus time from backend after update
          loadTotalFocusTime()
        }).catch(err => {
          console.error('Failed to update focus session:', err)
        })
        
        setSessionStartTime(null)
        setCurrentFocusSessionId(null)
        
        // Increment session count
        const newSessionCount = sessionCount + 1
        setSessionCount(newSessionCount)
        
        // Check if we need a long rest (after 3 sessions)
        if (newSessionCount >= 3) {
          // Long rest: 25 minutes, cannot be changed
          setPomodoroTime(25 * 60)
          setIsRest(true)
          setIsBreak(false)
          setSessionCount(0) // Reset session count
          NotificationService.showBreakReminder()
        } else {
          // Regular break
          setPomodoroTime(breakDuration * 60)
          setIsBreak(true)
          setIsRest(false)
          NotificationService.showBreakReminder()
        }
      } else if (isBreak && !isRest) {
        // Break ended, go back to focus
        setPomodoroTime(getFocusDurationSeconds())
        setIsBreak(false)
        NotificationService.showWorkResume()
      } else if (isRest) {
        // Long rest ended, go back to focus
        setPomodoroTime(getFocusDurationSeconds())
        setIsRest(false)
        setIsBreak(false)
        NotificationService.showWorkResume()
      }
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, pomodoroTime, isBreak, isRest, breakDuration, sessionCount, sessionStartTime, currentFocusSessionId, focusDuration])

  // Request notification permission on mount
  useEffect(() => {
    if (user) {
      NotificationService.requestPermission()
    }
  }, [user])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }



  const completedTasks = tasks.filter((task) => task.completed).length
  const totalTasks = tasks.length

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <NavigationBar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Welcome back, {user.username}! 👋</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Not sure where to start? Visit the{" "}
            <Link href="/chat" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              AI Chatbot
            </Link>
            {" "}for guides on how to use the app!
          </p>
        </div>

        {/* Desktop Buddy */}
        <Card className="mb-8 bg-gradient-to-r from-purple-100 to-pink-100 border-purple-200 dark:from-purple-900 dark:to-pink-900 dark:border-purple-800">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="text-6xl">{getBuddyEmoji(buddyAppearance)}</div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-purple-800 dark:text-purple-200 mb-2">Your {buddyName} says:</h3>
                <p className="text-purple-700 dark:text-purple-300">
                  "Good morning! Remember, every small step counts towards your goals! 💪"
                </p>
              </div>
            </div>
          </CardContent>
        </Card>


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pomodoro Timer */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Timer className="h-5 w-5 text-blue-500" />
                  <span>Focus Timer (Pomodoro)</span>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
                          <Info className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="bottom" 
                        className="max-w-sm p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
                      >
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">What is the Pomodoro Technique?</h4>
                            <p className="text-xs text-gray-700 dark:text-gray-300">
                              The Pomodoro Technique is a time management method that uses a timer to break work into intervals,
                              traditionally 25 minutes in length, separated by short breaks. This technique helps improve focus,
                              reduce mental fatigue, and maintain productivity throughout the day.
                            </p>
                          </div>
                          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">How it works:</h4>
                            <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
                              <li>Set a timer for your focus session (25-60 minutes)</li>
                              <li>Work on your task until the timer rings</li>
                              <li>Take a mandatory break (5-10 minutes)</li>
                              <li>After 3 consecutive sessions, take a longer rest (25 minutes)</li>
                            </ul>
                          </div>
                          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">Benefits:</h4>
                            <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
                              <li>Improves focus and concentration</li>
                              <li>Reduces procrastination</li>
                              <li>Prevents burnout by enforcing regular breaks</li>
                              <li>Increases awareness of time and productivity</li>
                            </ul>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Badge variant={isRest ? "destructive" : isBreak ? "secondary" : "default"}>
                    {isRest ? "Long Rest" : isBreak ? "Break Time" : "Focus Time"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-6">
                  <div className="text-6xl font-mono font-bold text-blue-600">{formatTime(pomodoroTime)}</div>
                  <Progress
                    value={
                      isRest
                        ? ((25 * 60 - pomodoroTime) / (25 * 60)) * 100
                        : isBreak
                        ? ((breakDuration * 60 - pomodoroTime) / (breakDuration * 60)) * 100
                        : ((getFocusDurationSeconds() - pomodoroTime) / getFocusDurationSeconds()) * 100
                    }
                    className="w-full h-2"
                  />
                  
                  {/* Focus Duration and Break Duration Selection - Sliders */}
                  {!isBreak && !isRest && !isRunning && (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Focus Duration: {focusDuration} minutes</label>
                          <span className="text-xs text-gray-500">(25-60 min, 5-min increments)</span>
                        </div>
                        <Slider
                          value={[focusDuration]}
                          onValueChange={(value) => {
                            const newValue = Math.round(value[0] / 5) * 5 // Round to nearest 5
                            const clampedValue = Math.max(25, Math.min(60, newValue))
                            setFocusDuration(clampedValue)
                            setPomodoroTime(clampedValue * 60)
                          }}
                          min={25}
                          max={60}
                          step={5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>25 min</span>
                          <span>60 min</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Break Duration: {breakDuration} minutes</label>
                          <span className="text-xs text-gray-500">(5-10 min, 1-min increments)</span>
                        </div>
                        <Slider
                          value={[breakDuration]}
                          onValueChange={(value) => {
                            const clampedValue = Math.max(5, Math.min(10, value[0]))
                            setBreakDuration(clampedValue)
                          }}
                          min={5}
                          max={10}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>5 min</span>
                          <span>10 min</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Long Rest Info */}
                  {isRest && !isRunning && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-800 font-medium">
                        Long Rest Period (25 minutes)
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        After 3 consecutive focus sessions, a longer rest is recommended. You can skip it if needed.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-center space-x-4">
                    <Button
                      onClick={() => setIsRunning(!isRunning)}
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={pomodoroTime === 0}
                    >
                      {isRunning ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                      {isRunning ? "Pause" : isRest ? "Rest Period" : "Start"}
                    </Button>
                    {isRunning && !isBreak && !isRest && (
                      <Button
                        onClick={completeTimerEarly}
                        size="lg"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Complete
                      </Button>
                    )}
                    {isBreak && !isRest && !isRunning && (
                      <Button
                        onClick={() => {
                          // Skip break and go back to focus
                          setPomodoroTime(getFocusDurationSeconds())
                          setIsBreak(false)
                          NotificationService.showWorkResume()
                        }}
                        size="lg"
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        Skip Break
                      </Button>
                    )}
                    {isRest && !isRunning && (
                      <Button
                        onClick={() => {
                          // Skip rest and go back to focus
                          setPomodoroTime(getFocusDurationSeconds())
                          setIsRest(false)
                          setIsBreak(false)
                          NotificationService.showWorkResume()
                        }}
                        size="lg"
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        Skip Rest
                      </Button>
                    )}
                    {!isRest && (
                      <Button
                        onClick={() => {
                          // If timer is stopped and already reset (not in break), go back to focus timer settings
                          if (!isRunning && !isBreak && pomodoroTime === getFocusDurationSeconds()) {
                            // Reset all timer state to go back to initial settings
                            setIsBreak(false)
                            setIsRest(false)
                            setSessionCount(0)
                            setPomodoroTime(getFocusDurationSeconds())
                            setSessionStartTime(null)
                            setCurrentFocusSessionId(null)
                            return
                          }
                          
                          // Otherwise, reset the timer and stop it
                          setIsRunning(false)
                          if (isBreak) {
                            setPomodoroTime(breakDuration * 60)
                          } else {
                            setPomodoroTime(getFocusDurationSeconds())
                          }
                          if (sessionStartTime && currentFocusSessionId) {
                            const end = new Date()
                            const elapsed = Math.floor((end.getTime() - sessionStartTime.getTime()) / 1000)
                            setTotalFocusTime(prev => prev + elapsed)
                            
                            // Update focus session in backend
                            api.updateFocusSession(currentFocusSessionId, end.toISOString(), elapsed).catch(err => {
                              console.error('Failed to update focus session:', err)
                            })
                            
                            setSessionStartTime(null)
                            setCurrentFocusSessionId(null)
                          }
                        }}
                        variant="outline"
                        size="lg"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Daily Motivation */}
            <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 dark:from-yellow-900/20 dark:to-orange-900/20 dark:border-yellow-800/30">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-orange-800 dark:text-orange-300">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">✨</span>
                    <span>Daily Motivation</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchQuote}
                    disabled={quoteLoading}
                    className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                  >
                    {quoteLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quoteLoading && !quote ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-orange-600 dark:text-orange-400" />
                    <span className="ml-2 text-orange-600 dark:text-orange-400">Loading quote...</span>
                  </div>
                ) : quoteError && !quote ? (
                  <div className="text-orange-600 dark:text-orange-400 text-sm">
                    {quoteError}
                  </div>
                ) : quote ? (
                  <>
                    <blockquote className="text-orange-700 dark:text-orange-300 italic">
                      "{quote.text}"
                    </blockquote>
                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">- {quote.author}</p>
                    {quoteError && (
                      <p className="text-xs text-orange-500 dark:text-orange-500/70 mt-1">
                        (Using fallback quote - API unavailable)
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-orange-600 dark:text-orange-400 text-sm">No quote available</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Upcoming Calendar Events */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-purple-500" />
                    <span>Upcoming Calendar Events</span>
                    <span className="text-xs font-normal text-gray-500">(Up to 30 days)</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshEvents}
                    disabled={eventsLoading}
                  >
                    {eventsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </CardTitle>
                {calendarConnections.length > 0 && (
                  <CardDescription className="dark:text-gray-400">
                    Connected to: {calendarConnections.map(c => c.account_email || c.calendar_name).filter(Boolean).join(', ')}
                    {' '}
                    <Link 
                      href="/settings#calendar-integration" 
                      className="text-blue-600 dark:text-blue-400 hover:underline text-xs ml-1"
                    >
                      (Change)
                    </Link>
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-400" />
                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading events...</span>
                  </div>
                ) : upcomingEvents.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {upcomingEvents.map((event) => (
                        <div key={event.id} className="flex items-center space-x-3">
                          <div className={`w-2 h-2 ${getEventColor(event.provider)} rounded-full`}></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{event.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatEventTime(event)}</p>
                            {event.location && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">📍 {event.location}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {eventsTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePreviousPage}
                          disabled={!eventsHasPrevious || eventsLoading}
                          className="flex items-center space-x-1"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <span>Previous</span>
                        </Button>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Page {eventsPage} of {eventsTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNextPage}
                          disabled={!eventsHasNext || eventsLoading}
                          className="flex items-center space-x-1"
                        >
                          <span>Next</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming events</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      <Link href="/settings#calendar-integration" className="text-purple-600 dark:text-purple-400 hover:underline">
                        Connect a calendar
                      </Link>
                      {' '}to see your events here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Today's Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckSquare className="h-5 w-5 text-green-500" />
                  <span>Today's Tasks</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tasksLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-gray-500">Loading tasks...</span>
                    </div>
                  ) : tasks.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No tasks yet.</p>
                  ) : (
                    <>
                      {tasks.slice(0, 3).map((task) => {
                        const deadlineExceeded = !task.completed && isDeadlineExceeded(task.dueDate)
                        return (
                          <div
                            key={task.id}
                            className={`p-3 rounded-lg border ${
                              deadlineExceeded
                                ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
                                : task.completed
                                ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700"
                                : "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700"
                            }`}
                          >
                            <p className={`text-sm font-medium mb-2 ${task.completed ? "line-through text-gray-500" : ""}`}>
                              {task.title}
                            </p>
                            <div className="flex items-center space-x-2 flex-wrap gap-1">
                              <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                              </Badge>
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
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                  <div className="pt-2 border-t">
                    <Link 
                      href="/tasks" 
                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      See Tasks Details
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
