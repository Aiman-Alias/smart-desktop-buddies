"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BarChart3, Clock, Target, TrendingUp, AlertTriangle, Activity, Loader2, Calendar as CalendarIcon, ChevronDown } from "lucide-react"
import { api, Task as ApiTask, CalendarEvent } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { NavigationBar } from "@/components/navigation-bar"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTheme } from "next-themes"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts"

interface AnalyticsData {
  date: string
  focusTime: number
  tasksCompleted: number
  mood: number
  screenTime: number
  breaks: number
}

interface MoodEntryDisplay {
  date: string
  mood: string
  value: number
  note?: string
  timestamp: string
  id?: number
  score?: number
}

export default function Analytics() {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([])
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => {
    // Default to start of current week (Monday)
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
    const monday = new Date(today.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moodEntries, setMoodEntries] = useState<MoodEntryDisplay[]>([])
  const [tasks, setTasks] = useState<ApiTask[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])
  const { user } = useAuth()

  // Load mood entries
  const loadMoodEntries = async () => {
    if (!user) return
    try {
      const entries = await api.getMoodEntries()
      const displayEntries: MoodEntryDisplay[] = entries.map((entry) => {
        // Extract score from note if present
        let score: number | undefined = undefined
        let cleanNote = entry.note || ""
        
        if (entry.note && entry.note.startsWith("SCORE:")) {
          const scoreMatch = entry.note.match(/^SCORE:(\d+)(?:\|(.+))?$/)
          if (scoreMatch) {
            score = parseInt(scoreMatch[1], 10)
            cleanNote = scoreMatch[2] || ""
          }
        }
        
        return {
          date: new Date(entry.created_at).toLocaleDateString(),
          mood: entry.mood,
          value: entry.mood === "very_happy" ? 3 : entry.mood === "happy" ? 2 : entry.mood === "neutral" ? 1 : 0,
          note: cleanNote,
          timestamp: entry.created_at,
          id: entry.id,
          score: score,
        }
      })
      setMoodEntries(displayEntries)
    } catch (err) {
      console.error('Failed to load mood entries:', err)
    }
  }

  // Load tasks
  const loadTasks = async () => {
    if (!user) return
    try {
      const apiTasks = await api.getTasks()
      setTasks(apiTasks)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    }
  }

  // Load upcoming events
  const loadUpcomingEvents = async () => {
    if (!user) return
    try {
      // Get events for next 30 days, page 1, with pageSize 10
      const result = await api.getUpcomingEvents(30, 1, 10)
      console.log('Analytics: Loaded upcoming events:', result)
      if (result && result.events) {
        setUpcomingEvents(result.events)
      } else {
        console.warn('Analytics: No events in result:', result)
        setUpcomingEvents([])
      }
    } catch (err) {
      console.error('Failed to load upcoming events:', err)
      setUpcomingEvents([])
    }
  }

  useEffect(() => {
    if (!user) return

    const loadAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)
        // Load 90 days of data to support historical week selection
        const result = await api.getAnalytics(90)
        
        // Convert backend data to frontend format
        const convertedData: AnalyticsData[] = result.daily_data.map((day: any) => ({
          date: day.date,
          focusTime: day.focusTime || 0,
          tasksCompleted: day.tasksCompleted || 0,
          mood: day.mood || 0,
          screenTime: day.screenTime || 0,
          breaks: day.breaks || 0,
        }))
        
        setAnalyticsData(convertedData)
      } catch (err) {
        console.error('Failed to load analytics:', err)
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
        // Fallback to empty data
        setAnalyticsData([])
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
    loadMoodEntries()
    loadTasks()
    loadUpcomingEvents()
  }, [user])

  // Filter analytics data for the selected week
  const getWeekAnalyticsData = () => {
    const weekEnd = new Date(weekStartDate)
    weekEnd.setDate(weekStartDate.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    
    return analyticsData.filter(day => {
      const dayDate = new Date(day.date)
      dayDate.setHours(0, 0, 0, 0)
      return dayDate >= weekStartDate && dayDate <= weekEnd
    })
  }

  const weekAnalyticsData = getWeekAnalyticsData()

  // Generate week data for focus time and task completion graphs (always 7 days)
  const generateWeekChartData = () => {
    const weekData = []
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStartDate)
      currentDate.setDate(weekStartDate.getDate() + i)
      currentDate.setHours(0, 0, 0, 0)
      
      // Find matching data for this day
      const dayData = weekAnalyticsData.find(day => {
        const dayDate = new Date(day.date)
        dayDate.setHours(0, 0, 0, 0)
        return dayDate.getTime() === currentDate.getTime()
      })
      
      // Format date for display
      const localDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
      const dateLabel = localDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      
      weekData.push({
        date: dateLabel,
        focusTime: dayData ? Math.round(dayData.focusTime / 60) : 0, // Convert to hours, default to 0
        tasks: dayData ? dayData.tasksCompleted : 0,
        mood: dayData ? dayData.mood : 0,
        screenTime: dayData ? Math.round(dayData.screenTime / 60) : 0,
        breaks: dayData ? dayData.breaks : 0,
      })
    }
    
    return weekData
  }

  const chartData = generateWeekChartData()

  const totalFocusTime = weekAnalyticsData.reduce((sum, day) => sum + day.focusTime, 0)
  const averageFocusTime = weekAnalyticsData.length > 0 ? Math.round(totalFocusTime / weekAnalyticsData.length) : 0
  const totalTasksCompleted = weekAnalyticsData.reduce((sum, day) => sum + day.tasksCompleted, 0)
  const averageMood =
    analyticsData.length > 0
      ? (analyticsData.reduce((sum, day) => sum + day.mood, 0) / analyticsData.length).toFixed(1)
      : "0"

  // Helper function to check if deadline is exceeded
  const isDeadlineExceeded = (dueDate: string | null | undefined): boolean => {
    if (!dueDate) return false
    const deadline = new Date(dueDate)
    const now = new Date()
    return deadline < now && !isNaN(deadline.getTime())
  }

  // Helper function to check if deadline is within 24 hours
  const isDeadlineClose = (dueDate: string | null | undefined): boolean => {
    if (!dueDate) return false
    const deadline = new Date(dueDate)
    const now = new Date()
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
    return hoursUntilDeadline > 0 && hoursUntilDeadline <= 24 && !isNaN(deadline.getTime())
  }

  // Calculate current date average mood
  const getCurrentDateAverageMood = (): number => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)
    
    const todayEntries = moodEntries.filter(entry => {
      const entryDate = new Date(entry.timestamp)
      return entryDate >= today && entryDate <= todayEnd
    })
    
    if (todayEntries.length === 0) return 0
    
    const scores = todayEntries
      .map(entry => entry.score)
      .filter((score): score is number => score !== undefined && score !== null)
    
    if (scores.length === 0) return 0
    
    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }

  // Calculate task metrics
  const tasksDone = tasks.filter(task => task.status === 'completed').length
  const tasksCloseToDeadline = tasks.filter(task => 
    !task.completed && task.due_date && isDeadlineClose(task.due_date)
  ).length
  const tasksExceededDeadline = tasks.filter(task => 
    !task.completed && task.due_date && isDeadlineExceeded(task.due_date)
  ).length

  // Calculate burnout score (accepts average mood as parameter)
  const calculateBurnoutScore = (averageMood: number): number => {
    // Average mood is inverted: (10 - averageMood)
    const moodContribution = averageMood > 0 ? (10 - averageMood) : 0
    
    // Tasks done * -1 (completed tasks reduce burnout)
    const tasksDoneContribution = tasksDone * -1
    
    // Tasks close to deadline * 1
    const tasksCloseContribution = tasksCloseToDeadline * 1
    
    // Tasks exceeded deadline * 2
    const tasksExceededContribution = tasksExceededDeadline * 2
    
    // Upcoming events * 1
    const upcomingEventsContribution = upcomingEvents.length * 1
    
    return moodContribution + tasksDoneContribution + tasksCloseContribution + tasksExceededContribution + upcomingEventsContribution
  }

  // Get burnout category based on score
  const getBurnoutCategory = (score: number): { label: string; textColor: string; bgColor: string; borderColor: string } => {
    if (score <= 10) {
      return { 
        label: "Low", 
        textColor: "text-green-700", 
        bgColor: "bg-green-100", 
        borderColor: "border-green-300" 
      }
    } else if (score <= 20) {
      return { 
        label: "Moderate", 
        textColor: "text-yellow-700", 
        bgColor: "bg-yellow-100", 
        borderColor: "border-yellow-300" 
      }
    } else if (score <= 40) {
      return { 
        label: "High", 
        textColor: "text-orange-700", 
        bgColor: "bg-orange-100", 
        borderColor: "border-orange-300" 
      }
    } else {
      return { 
        label: "Critical", 
        textColor: "text-red-700", 
        bgColor: "bg-red-100", 
        borderColor: "border-red-300" 
      }
    }
  }

  // Generate week data for mood chart (same as mood tracker)
  const generateWeekData = () => {
    const weekData = []
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStartDate)
      currentDate.setDate(weekStartDate.getDate() + i)
      currentDate.setHours(0, 0, 0, 0)
      const dayEnd = new Date(currentDate)
      dayEnd.setHours(23, 59, 59, 999)
      
      // Find all entries for this day (compare by date only, ignoring time)
      const dayEntries = moodEntries.filter(entry => {
        const entryDate = new Date(entry.timestamp)
        // Normalize both dates to midnight for comparison
        const entryDateOnly = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate())
        const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
        return entryDateOnly.getTime() === currentDateOnly.getTime()
      })
      
      // Calculate average score for the day
      let averageScore: number | null = null
      if (dayEntries.length > 0) {
        const scores = dayEntries
          .map(entry => entry.score)
          .filter((score): score is number => score !== undefined && score !== null)
        
        if (scores.length > 0) {
          averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
        }
      }
      
      // Format date components manually to avoid timezone issues
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const day = currentDate.getDate()
      
      // Create a local date for formatting (no timezone conversion)
      const localDate = new Date(year, month, day)
      
      weekData.push({
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        year: year,
        month: month,
        day: day,
        dayName: localDate.toLocaleDateString('en-US', { weekday: 'short' }),
        dayMonth: localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDateString: localDate.toLocaleDateString('en-US', { 
          weekday: 'long',
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        }),
        average: averageScore,
        count: dayEntries.length
      })
    }
    
    return weekData
  }

  const weekChartData = generateWeekData()
  const currentDateAverageMood = getCurrentDateAverageMood()
  
  // Calculate burnout score and category
  const burnoutScore = calculateBurnoutScore(currentDateAverageMood)
  const burnoutCategory = getBurnoutCategory(burnoutScore)

  // Analysis functions for Detailed Insights
  const analyzeFocusTimeTrend = () => {
    if (weekAnalyticsData.length < 2) return null
    
    const focusTimes = weekAnalyticsData.map(d => d.focusTime)
    const firstHalf = focusTimes.slice(0, Math.ceil(focusTimes.length / 2))
    const secondHalf = focusTimes.slice(Math.ceil(focusTimes.length / 2))
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    
    const trend = secondAvg > firstAvg ? "increasing" : secondAvg < firstAvg ? "decreasing" : "stable"
    const change = Math.abs(((secondAvg - firstAvg) / (firstAvg || 1)) * 100).toFixed(0)
    const maxDay = weekAnalyticsData.reduce((max, day) => day.focusTime > max.focusTime ? day : max, weekAnalyticsData[0])
    const minDay = weekAnalyticsData.reduce((min, day) => day.focusTime < min.focusTime ? day : min, weekAnalyticsData[0])
    
    return {
      trend,
      change,
      avgHours: (averageFocusTime / 60).toFixed(1),
      maxDay: new Date(maxDay.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      maxHours: (maxDay.focusTime / 60).toFixed(1),
      minDay: new Date(minDay.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      minHours: (minDay.focusTime / 60).toFixed(1)
    }
  }

  const analyzeTaskCompletion = () => {
    if (weekAnalyticsData.length === 0) return null
    
    const taskCounts = weekAnalyticsData.map(d => d.tasksCompleted)
    const avgTasks = (totalTasksCompleted / weekAnalyticsData.length).toFixed(1)
    const maxTasks = Math.max(...taskCounts)
    const minTasks = Math.min(...taskCounts)
    
    const firstHalf = taskCounts.slice(0, Math.ceil(taskCounts.length / 2))
    const secondHalf = taskCounts.slice(Math.ceil(taskCounts.length / 2))
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    
    const trend = secondAvg > firstAvg ? "improving" : secondAvg < firstAvg ? "declining" : "consistent"
    const consistency = taskCounts.every(count => count === taskCounts[0]) ? "very consistent" : 
                      (maxTasks - minTasks <= 2) ? "fairly consistent" : "variable"
    
    return {
      avgTasks,
      maxTasks,
      minTasks,
      trend,
      consistency,
      totalTasks: totalTasksCompleted
    }
  }

  const analyzeMoodTrends = () => {
    if (weekChartData.length === 0) return null
    
    const moodScores = weekChartData
      .map(day => day.average)
      .filter((score): score is number => score !== null && score !== undefined)
    
    if (moodScores.length === 0) return null
    
    const avgMood = (moodScores.reduce((a, b) => a + b, 0) / moodScores.length).toFixed(1)
    const maxMood = Math.max(...moodScores)
    const minMood = Math.min(...moodScores)
    
    const firstHalf = moodScores.slice(0, Math.ceil(moodScores.length / 2))
    const secondHalf = moodScores.slice(Math.ceil(moodScores.length / 2))
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    
    const trend = secondAvg > firstAvg ? "improving" : secondAvg < firstAvg ? "declining" : "stable"
    
    const bestDay = weekChartData.find(day => day.average === maxMood)
    const worstDay = weekChartData.find(day => day.average === minMood)
    
    return {
      avgMood,
      maxMood: maxMood.toFixed(1),
      minMood: minMood.toFixed(1),
      trend,
      bestDay: bestDay?.dayMonth || "N/A",
      worstDay: worstDay?.dayMonth || "N/A"
    }
  }

  const analyzeBurnoutStatus = () => {
    const moodContribution = currentDateAverageMood > 0 ? (10 - currentDateAverageMood) : 0
    const mainContributors = []
    
    if (moodContribution > 5) mainContributors.push("lower mood levels")
    if (tasksExceededDeadline > 0) mainContributors.push(`${tasksExceededDeadline} exceeded deadline${tasksExceededDeadline > 1 ? 's' : ''}`)
    if (tasksCloseToDeadline > 2) mainContributors.push(`${tasksCloseToDeadline} tasks approaching deadline`)
    if (tasksDone > 8) mainContributors.push("high task volume")
    
    return {
      score: burnoutScore.toFixed(1),
      category: burnoutCategory.label,
      mainContributors: mainContributors.length > 0 ? mainContributors : ["balanced workload"]
    }
  }

  const focusTimeAnalysis = analyzeFocusTimeTrend()
  const taskAnalysis = analyzeTaskCompletion()
  const moodAnalysis = analyzeMoodTrends()
  const burnoutAnalysis = analyzeBurnoutStatus()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <NavigationBar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-end items-center space-x-2 mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">Week starting:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-[200px] justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {weekStartDate ? (
                  weekStartDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={weekStartDate}
                onSelect={(date) => {
                  if (date) {
                    // Set to start of selected day
                    const selectedDate = new Date(date)
                    selectedDate.setHours(0, 0, 0, 0)
                    setWeekStartDate(selectedDate)
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing week: {weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {' '}
            {(() => {
              const weekEnd = new Date(weekStartDate)
              weekEnd.setDate(weekStartDate.getDate() + 6)
              return weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            })()}
            </div>
          </div>
        </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
            <span className="ml-4 text-gray-600">Loading analytics data...</span>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg Focus Time</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {Math.round(averageFocusTime / 60)}h {averageFocusTime % 60}m
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Tasks Completed</p>
                      <p className="text-2xl font-bold text-green-600">{totalTasksCompleted}</p>
                    </div>
                    <Target className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg Mood</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {currentDateAverageMood > 0 ? currentDateAverageMood.toFixed(1) : "N/A"}/10
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Focus Time Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    <span>Focus Time Trend</span>
                  </CardTitle>
                  <CardDescription>Daily focus time over the selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: isDark ? "#d1d5db" : "#374151", fontSize: 12 }}
                          stroke={isDark ? "#4b5563" : "#9ca3af"}
                        />
                        <YAxis 
                          tick={{ fill: isDark ? "#d1d5db" : "#374151", fontSize: 12 }}
                          stroke={isDark ? "#4b5563" : "#9ca3af"}
                        />
                        <Tooltip 
                          formatter={(value: number) => [`${value} hours`, "Focus Time"]}
                          contentStyle={{
                            backgroundColor: isDark ? "#1f2937" : "#ffffff",
                            border: isDark ? "1px solid #374151" : "1px solid #e5e7eb",
                            borderRadius: "6px",
                            color: isDark ? "#e5e7eb" : "#111827",
                          }}
                          labelStyle={{
                            color: isDark ? "#d1d5db" : "#374151",
                          }}
                          itemStyle={{
                            color: isDark ? "#e5e7eb" : "#111827",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="focusTime"
                          stroke="#8884d8"
                          strokeWidth={3}
                          dot={{ fill: "#8884d8", strokeWidth: 2, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Task Completion */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-green-500" />
                    <span>Task Completion</span>
                  </CardTitle>
                  <CardDescription>Daily tasks completed over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: isDark ? "#d1d5db" : "#374151", fontSize: 12 }}
                          stroke={isDark ? "#4b5563" : "#9ca3af"}
                        />
                        <YAxis 
                          tick={{ fill: isDark ? "#d1d5db" : "#374151", fontSize: 12 }}
                          stroke={isDark ? "#4b5563" : "#9ca3af"}
                        />
                        <Tooltip 
                          formatter={(value: number) => [`${value} tasks`, "Completed"]}
                          contentStyle={{
                            backgroundColor: isDark ? "#111827" : "#ffffff",
                            border: isDark ? "1px solid #1e293b" : "1px solid #e5e7eb",
                            borderRadius: "6px",
                            color: isDark ? "#cbd5e1" : "#111827",
                          }}
                          labelStyle={{
                            color: isDark ? "#94a3b8" : "#374151",
                          }}
                          itemStyle={{
                            color: isDark ? "#cbd5e1" : "#111827",
                          }}
                        />
                        <Bar dataKey="tasks" fill="#82ca9d" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Burnout Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <span>Burnout Analysis</span>
                  </CardTitle>
                  <CardDescription>Current status and workload indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Burnout Score Display */}
                  <div className={`text-center p-4 rounded-lg border-2 ${burnoutCategory.borderColor} ${burnoutCategory.bgColor}`}>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Burnout Score</div>
                    <div className={`text-4xl font-bold mb-2 ${burnoutCategory.textColor}`}>
                      {burnoutScore.toFixed(1)}
                    </div>
                    <Badge className={`${burnoutCategory.bgColor} ${burnoutCategory.textColor} text-base px-3 py-1 border ${burnoutCategory.borderColor}`}>
                      {burnoutCategory.label} Risk
                    </Badge>
                  </div>

                  {/* Score Range Explanation */}
                  <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <p className="font-medium mb-1">Score Range:</p>
                    <ul className="space-y-1">
                      <li>• <span className="text-green-700 dark:text-green-400">0-10:</span> Low</li>
                      <li>• <span className="text-yellow-700 dark:text-yellow-400">10-20:</span> Moderate</li>
                      <li>• <span className="text-orange-700 dark:text-orange-400">20-40:</span> High</li>
                      <li>• <span className="text-red-700 dark:text-red-400">&gt;40:</span> Critical</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Average Mood (Today)</span>
                      <Badge
                        className={
                          currentDateAverageMood < 4 ? "bg-red-100 text-red-800" : 
                          currentDateAverageMood < 7 ? "bg-yellow-100 text-yellow-800" : 
                          "bg-green-100 text-green-800"
                        }
                      >
                        {currentDateAverageMood > 0 ? currentDateAverageMood.toFixed(1) : "N/A"}/10
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Tasks Done</span>
                      <Badge className="bg-green-100 text-green-800">
                        {tasksDone}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Tasks Close to Deadline (within 24h)</span>
                      <Badge
                        className={
                          tasksCloseToDeadline > 0 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"
                        }
                      >
                        {tasksCloseToDeadline}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Tasks Exceeded Deadline</span>
                      <Badge
                        className={
                          tasksExceededDeadline > 0 ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"
                        }
                      >
                        {tasksExceededDeadline}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Upcoming Events</span>
                      <Badge className="bg-blue-100 text-blue-800">
                        {upcomingEvents.length}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Mood Trends & Analysis */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <TrendingUp className="h-5 w-5 text-purple-500" />
                        <span>Mood Trends</span>
                      </CardTitle>
                      <CardDescription>Track your emotional patterns and insights</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weekChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
                        <XAxis 
                          dataKey="dayMonth" 
                          tick={{ fill: isDark ? "#d1d5db" : "#374151", fontSize: 12 }}
                          stroke={isDark ? "#4b5563" : "#9ca3af"}
                        />
                        <YAxis 
                          domain={[1, 10]} 
                          ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                          tick={{ fill: isDark ? "#d1d5db" : "#374151", fontSize: 12 }}
                          stroke={isDark ? "#4b5563" : "#9ca3af"}
                        />
                        <Tooltip
                          formatter={(value: number | null) => {
                            if (value === null) return ["No data", "Avg Score"]
                            return [`${value.toFixed(1)}/10`, "Avg Score"]
                          }}
                          labelFormatter={(value, payload) => {
                            if (payload && payload[0] && payload[0].payload) {
                              // Use the pre-formatted fullDateString to avoid timezone issues
                              const payloadData = payload[0].payload
                              if (payloadData.fullDateString) {
                                return payloadData.fullDateString
                              }
                              // Fallback: construct date from year, month, day (no timezone conversion)
                              if (payloadData.year !== undefined && payloadData.month !== undefined && payloadData.day !== undefined) {
                                const localDate = new Date(payloadData.year, payloadData.month, payloadData.day)
                                return localDate.toLocaleDateString('en-US', { 
                                  weekday: 'long',
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })
                              }
                              // Fallback to dayMonth if available
                              if (payloadData.dayMonth) {
                                return payloadData.dayMonth
                              }
                            }
                            return value
                          }}
                          contentStyle={{
                            backgroundColor: isDark ? "#1f2937" : "#ffffff",
                            border: isDark ? "1px solid #374151" : "1px solid #e5e7eb",
                            borderRadius: "6px",
                            color: isDark ? "#e5e7eb" : "#111827",
                          }}
                          labelStyle={{
                            color: isDark ? "#d1d5db" : "#374151",
                          }}
                          itemStyle={{
                            color: isDark ? "#e5e7eb" : "#111827",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="average"
                          stroke="#8884d8"
                          fill="#8884d8"
                          fillOpacity={0.3}
                          strokeWidth={2}
                          dot={{ fill: "#8884d8", strokeWidth: 2, r: 4 }}
                          connectNulls={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Insights */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Detailed Insights</CardTitle>
                <CardDescription>Comprehensive analysis of your productivity patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="productivity" className="border-none">
                      <AccordionTrigger className="hover:no-underline py-2">
                        <h4 className="font-semibold text-left">Productivity Analysis</h4>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 text-sm pt-2">
                      {/* Focus Time Trend Analysis */}
                      <div>
                        <p className="font-medium mb-1 text-blue-700 dark:text-blue-400">Focus Time Trend:</p>
                        {focusTimeAnalysis ? (
                          <div className="ml-4 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                            <p>• Your focus time is <strong>{focusTimeAnalysis.trend}</strong> over the week ({focusTimeAnalysis.change}% change)</p>
                            <p>• Average focus time: <strong>{focusTimeAnalysis.avgHours} hours</strong> per day</p>
                            <p>• Best day: <strong>{focusTimeAnalysis.maxDay}</strong> with {focusTimeAnalysis.maxHours} hours</p>
                            <p>• Lowest day: <strong>{focusTimeAnalysis.minDay}</strong> with {focusTimeAnalysis.minHours} hours</p>
                          </div>
                        ) : (
                          <p className="ml-4 text-xs text-gray-600 dark:text-gray-400">Insufficient data to analyze focus time trends.</p>
                        )}
                      </div>

                      {/* Task Completion Analysis */}
                      <div>
                        <p className="font-medium mb-1 text-green-700 dark:text-green-400">Task Completion:</p>
                        {taskAnalysis ? (
                          <div className="ml-4 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                            <p>• Completed <strong>{taskAnalysis.totalTasks} tasks</strong> this week (avg: {taskAnalysis.avgTasks} per day)</p>
                            <p>• Task completion trend is <strong>{taskAnalysis.trend}</strong></p>
                            <p>• Consistency: <strong>{taskAnalysis.consistency}</strong> (range: {taskAnalysis.minTasks}-{taskAnalysis.maxTasks} tasks/day)</p>
                          </div>
                        ) : (
                          <p className="ml-4 text-xs text-gray-600 dark:text-gray-400">No task completion data available.</p>
                        )}
                      </div>

                      {/* Mood Trends Analysis */}
                      <div>
                        <p className="font-medium mb-1 text-purple-700 dark:text-purple-400">Mood Trends:</p>
                        {moodAnalysis ? (
                          <div className="ml-4 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                            <p>• Average mood score: <strong>{moodAnalysis.avgMood}/10</strong> for the week</p>
                            <p>• Mood trend is <strong>{moodAnalysis.trend}</strong> over the week</p>
                            <p>• Best day: <strong>{moodAnalysis.bestDay}</strong> ({moodAnalysis.maxMood}/10)</p>
                            <p>• Lowest day: <strong>{moodAnalysis.worstDay}</strong> ({moodAnalysis.minMood}/10)</p>
                          </div>
                        ) : (
                          <p className="ml-4 text-xs text-gray-600 dark:text-gray-400">No mood data available for analysis.</p>
                        )}
                      </div>

                      {/* Burnout Analysis */}
                      <div>
                        <p className="font-medium mb-1 text-orange-700 dark:text-orange-400">Burnout Status:</p>
                        <div className="ml-4 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                          <p>• Current burnout score: <strong>{burnoutAnalysis.score}</strong> ({burnoutAnalysis.category} risk)</p>
                          <p>• Main contributors: {burnoutAnalysis.mainContributors.join(", ")}</p>
                          <p>• Today's average mood: <strong>{currentDateAverageMood > 0 ? currentDateAverageMood.toFixed(1) : "N/A"}/10</strong></p>
                          <p>• Active tasks: {tasksDone} done, {tasksCloseToDeadline} close to deadline, {tasksExceededDeadline} exceeded</p>
                        </div>
                      </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="burnout" className="border-none">
                      <AccordionTrigger className="hover:no-underline py-2">
                        <h4 className="font-semibold text-left">Burnout Analysis Metrics</h4>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 text-sm pt-2">
                      <div>
                        <p className="font-medium mb-2">Current Metrics:</p>
                        <ul className="space-y-1 ml-4">
                          <li>• Average Mood (Today): {currentDateAverageMood > 0 ? currentDateAverageMood.toFixed(1) : "N/A"}/10</li>
                          <li>• Tasks Done: {tasksDone}</li>
                          <li>• Tasks Close to Deadline (within 24h): {tasksCloseToDeadline}</li>
                          <li>• Tasks Exceeded Deadline: {tasksExceededDeadline}</li>
                          <li>• Upcoming Events: {upcomingEvents.length}</li>
                        </ul>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="font-medium mb-2">How the Burnout Score is Calculated:</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          The burnout score is calculated by summing the following components:
                        </p>
                        <ul className="space-y-1 ml-4 mt-1 text-xs text-gray-600 dark:text-gray-400">
                          <li>• Average mood (inverted): (10 - today's average mood)</li>
                          <li>• Tasks done: count × -1 (reduces burnout)</li>
                          <li>• Tasks close to deadline: count × 1</li>
                          <li>• Tasks exceeded deadline: count × 2</li>
                          <li>• Upcoming events: count × 1</li>
                        </ul>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                          <strong>Current calculation:</strong> (10 - {currentDateAverageMood > 0 ? currentDateAverageMood.toFixed(1) : "0"}) - {tasksDone} + {tasksCloseToDeadline} + ({tasksExceededDeadline} × 2) + ({upcomingEvents.length} × 1) = <strong>{burnoutScore.toFixed(1)}</strong>
                        </p>
                      </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}