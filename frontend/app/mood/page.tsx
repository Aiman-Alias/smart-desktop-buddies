"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
import { Heart, TrendingUp, Calendar as CalendarIcon, BookOpen, Loader2, Trash2, AlertTriangle, Edit2, Check, X } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from "recharts"
import { api, MoodEntry as ApiMoodEntry } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { MoodReminderService } from "@/lib/moodReminder"
import { NavigationBar } from "@/components/navigation-bar"
import { useTheme } from "next-themes"

interface MoodEntryDisplay {
  date: string
  mood: string
  value: number
  note?: string
  timestamp: string
  id?: number
  score?: number
}

export default function MoodTracker() {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const [moodEntries, setMoodEntries] = useState<MoodEntryDisplay[]>([])
  const [selectedMood, setSelectedMood] = useState<string | null>(null) // Currently selected mood (not yet submitted)
  const [moodScore, setMoodScore] = useState<number | null>(null) // Selected score (1-10)
  const [moodNote, setMoodNote] = useState("")
  const [moodDate, setMoodDate] = useState<Date | undefined>(undefined) // Selected date for mood entry
  const [moodTime, setMoodTime] = useState<string>("") // Selected time for mood entry
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [moodStats, setMoodStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => {
    // Default to start of current week (Monday)
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
    const monday = new Date(today.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday
  })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null)
  const [showClearAllDialog, setShowClearAllDialog] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null)
  const [editMood, setEditMood] = useState<string | null>(null)
  const [editScore, setEditScore] = useState<number | null>(null)
  const [editNote, setEditNote] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const { user } = useAuth()

  // Extract score from note (format: "SCORE:5|rest of note" or just "SCORE:5")
  const extractScoreFromNote = (note: string): { score: number | null; cleanNote: string } => {
    if (!note) return { score: null, cleanNote: "No notes" }
    
    const scoreMatch = note.match(/^SCORE:(\d+)(?:\|(.+))?$/)
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1], 10)
      const cleanNote = scoreMatch[2] || "No notes"
      return { score, cleanNote }
    }
    
    // Check if it's just "No notes" or empty
    if (note === "No notes" || note.trim() === "") {
      return { score: null, cleanNote: "No notes" }
    }
    
    return { score: null, cleanNote: note }
  }

  // Convert API mood entry to display format
  const convertToDisplay = (entry: ApiMoodEntry): MoodEntryDisplay => {
    const date = new Date(entry.created_at)
    const moodValue = entry.mood === 'very_happy' ? 5 : entry.mood === 'happy' ? 4 : entry.mood === 'neutral' ? 3 : entry.mood === 'sad' ? 2 : 1
    const displayMood = entry.mood === 'very_happy' ? 'happy' : entry.mood === 'very_sad' ? 'sad' : entry.mood
    
    const { score, cleanNote } = extractScoreFromNote(entry.note || "")
    
    return {
      id: entry.id,
      date: date.toDateString(),
      mood: displayMood,
      value: moodValue,
      note: cleanNote,
      timestamp: entry.created_at,
      score: score || undefined,
    }
  }

  // Load mood entries from API
  useEffect(() => {
    if (!user) return

    const loadMoodEntries = async () => {
      try {
        setLoading(true)
        setError(null)
        const entries = await api.getMoodEntries()
        
        // Convert to display format
        const displayEntries = entries.map(convertToDisplay)
        // Sort by timestamp (newest first)
        displayEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setMoodEntries(displayEntries)
      } catch (err) {
        console.error('Failed to load mood entries:', err)
        setError(err instanceof Error ? err.message : 'Failed to load mood entries')
      } finally {
        setLoading(false)
      }
    }

    loadMoodEntries()
    loadMoodStats()
    
    // Request notification permission and start daily reminder
    if (user) {
      import('@/lib/notifications').then(({ NotificationService }) => {
        NotificationService.requestPermission()
      })
      // Start daily mood reminder at 9 AM
      MoodReminderService.startDailyReminder('09:00')
    }

    return () => {
      MoodReminderService.stopReminder()
    }
  }, [user])

  // Load mood statistics
  const loadMoodStats = async () => {
    if (!user) return

    try {
      setStatsLoading(true)
      const stats = await api.getMoodStats()
      setMoodStats(stats)
    } catch (err) {
      console.error('Failed to load mood stats:', err)
      // Don't show error for stats, it's not critical
    } finally {
      setStatsLoading(false)
    }
  }

  // Select mood (doesn't submit yet)
  const selectMood = (mood: string) => {
    setSelectedMood(mood)
    setMoodScore(null) // Reset score when mood changes
    setError(null)
    // Set default date/time to current if not already set
    if (!moodDate) {
      setMoodDate(new Date())
    }
    if (!moodTime) {
      const now = new Date()
      const hours = now.getHours().toString().padStart(2, '0')
      const minutes = now.getMinutes().toString().padStart(2, '0')
      setMoodTime(`${hours}:${minutes}`)
    }
  }

  // Get score range for selected mood
  const getScoreRange = (mood: string | null): number[] => {
    if (mood === "sad") return [1, 2, 3, 4] // Tough: 1-4
    if (mood === "neutral") return [5, 6, 7] // Okay: 5-7
    if (mood === "happy") return [8, 9, 10] // Great: 8-10
    return []
  }

  // Validate that score matches the mood
  const validateScoreForMood = (mood: string | null, score: number | null): { valid: boolean; message?: string } => {
    if (!mood || score === null) {
      return { valid: false, message: "Please select both a mood and a score." }
    }
    
    const validScores = getScoreRange(mood)
    if (!validScores.includes(score)) {
      if (mood === "sad") {
        return { valid: false, message: "For a sad mood, the score must be between 1-4." }
      } else if (mood === "neutral") {
        return { valid: false, message: "For a neutral mood, the score must be between 5-7." }
      } else if (mood === "happy") {
        return { valid: false, message: "For a happy mood, the score must be between 8-10." }
      }
    }
    
    return { valid: true }
  }

  // Submit the mood entry
  const submitMood = async () => {
    if (!user || !selectedMood) return

    try {
      setSaving(true)
      setError(null)

      // Validate score is selected
      if (!moodScore) {
        setError("Please select a mood score before submitting.")
        setSaving(false)
        return
      }

      // Validate score matches the selected mood
      const scoreValidation = validateScoreForMood(selectedMood, moodScore)
      if (!scoreValidation.valid) {
        setError(scoreValidation.message || "The score does not match the selected mood.")
        setSaving(false)
        return
      }

      // Validate date is selected
      if (!moodDate) {
        setError("Please select a date for the mood entry.")
        setSaving(false)
        return
      }

      // Validate time is selected
      if (!moodTime || !moodTime.trim()) {
        setError("Please select a time for the mood entry.")
        setSaving(false)
        return
      }

      // Map frontend mood to backend mood values
      const backendMood = selectedMood === "happy" ? "happy" : selectedMood === "neutral" ? "neutral" : "sad"
      
      // Format note with score: "SCORE:5|rest of note" or "SCORE:5" if no note
      const cleanNote = moodNote.trim()
      const noteToSave = cleanNote 
        ? `SCORE:${moodScore}|${cleanNote}`
        : `SCORE:${moodScore}`

      // Format date and time
      let moodDateTime: Date
      if (moodDate instanceof Date) {
        moodDateTime = new Date(moodDate)
      } else {
        moodDateTime = new Date(moodDate)
      }
      
      // Validate the date
      if (isNaN(moodDateTime.getTime())) {
        setError("Invalid date selected.")
        setSaving(false)
        return
      }
      
      // Set time if provided
      if (moodTime && moodTime.trim()) {
        const timeParts = moodTime.split(':')
        if (timeParts.length >= 2) {
          const hours = parseInt(timeParts[0], 10)
          const minutes = parseInt(timeParts[1], 10)
          if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            moodDateTime.setHours(hours, minutes, 0, 0)
          } else {
            setError("Invalid time format. Please use HH:MM format.")
            setSaving(false)
            return
          }
        } else {
          setError("Invalid time format. Please use HH:MM format.")
          setSaving(false)
          return
        }
      }

      // Format as ISO string for backend
      const createdAtISO = moodDateTime.toISOString()
      console.log('Submitting mood entry with date/time:', {
        selectedDate: moodDate,
        selectedTime: moodTime,
        combinedDateTime: moodDateTime,
        isoString: createdAtISO
      })

      // Always create a new entry (don't update existing ones)
      const entry = await api.createMoodEntry(backendMood, noteToSave, createdAtISO)
      console.log('Created entry response:', entry)

      // Convert to display format
      const displayEntry = convertToDisplay(entry)
      
      // Add new entry to the list (prepend since we want newest first)
      const updatedEntries = [displayEntry, ...moodEntries]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      
      setMoodEntries(updatedEntries)
      
      // Reset form
      setSelectedMood(null)
      setMoodScore(null)
      setMoodNote("")
      setMoodDate(undefined)
      setMoodTime("")
      
      // Mark reminder as shown if this was triggered by reminder
      MoodReminderService.markReminderShown()
    } catch (err) {
      console.error('Failed to save mood entry:', err)
      setError(err instanceof Error ? err.message : 'Failed to save mood entry')
    } finally {
      setSaving(false)
    }
  }

  // Cancel mood selection
  const cancelMoodSelection = () => {
    setSelectedMood(null)
    setMoodScore(null)
    setMoodNote("")
    setMoodDate(undefined)
    setMoodTime("")
    setError(null)
  }

  // Open delete confirmation dialog
  const openDeleteDialog = (entryId: number) => {
    setEntryToDelete(entryId)
    setDeleteDialogOpen(true)
  }

  // Delete a mood entry (called after confirmation)
  const deleteMoodEntry = async () => {
    if (!user || !entryToDelete) return

    try {
      setError(null)
      await api.deleteMoodEntry(entryToDelete)
      
      // Remove the entry from the list
      setMoodEntries(moodEntries.filter(entry => entry.id !== entryToDelete))
      
      // Reload stats to reflect the deletion
      loadMoodStats()
      
      // Close dialog and reset
      setDeleteDialogOpen(false)
      setEntryToDelete(null)
    } catch (err) {
      console.error('Failed to delete mood entry:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete mood entry')
      setDeleteDialogOpen(false)
      setEntryToDelete(null)
    }
  }

  // Start editing a mood entry
  const startEditing = (entry: MoodEntryDisplay) => {
    setEditingEntryId(entry.id || null)
    setEditMood(entry.mood)
    setEditScore(entry.score || null)
    setEditNote(entry.note === "No notes" ? "" : entry.note || "")
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingEntryId(null)
    setEditMood(null)
    setEditScore(null)
    setEditNote("")
  }

  // Save edited mood entry
  const saveEdit = async () => {
    if (!user || !editingEntryId || !editMood) return

    try {
      setSavingEdit(true)
      setError(null)

      // Validate score if provided
      if (editScore !== null) {
        const scoreValidation = validateScoreForMood(editMood, editScore)
        if (!scoreValidation.valid) {
          setError(scoreValidation.message || "The score does not match the selected mood.")
          setSavingEdit(false)
          return
        }
      }

      // Map frontend mood to backend mood values
      const backendMood = editMood === "happy" ? "happy" : editMood === "neutral" ? "neutral" : "sad"
      
      // Format note with score: "SCORE:5|rest of note" or "SCORE:5" if no note
      const cleanNote = editNote.trim()
      const noteToSave = editScore !== null
        ? (cleanNote ? `SCORE:${editScore}|${cleanNote}` : `SCORE:${editScore}`)
        : (cleanNote || "")

      // Update the entry
      const updatedEntry = await api.updateMoodEntry(editingEntryId, backendMood, noteToSave)
      
      // Convert to display format
      const displayEntry = convertToDisplay(updatedEntry)
      
      // Update the entry in the list
      const updatedEntries = moodEntries.map(entry => 
        entry.id === editingEntryId ? displayEntry : entry
      ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      
      setMoodEntries(updatedEntries)
      
      // Reset edit state
      cancelEditing()
      
      // Reload stats to reflect the update
      loadMoodStats()
    } catch (err) {
      console.error('Failed to update mood entry:', err)
      setError(err instanceof Error ? err.message : 'Failed to update mood entry')
    } finally {
      setSavingEdit(false)
    }
  }

  // Delete all mood entries (called after confirmation)
  const deleteAllMoodEntries = async () => {
    if (!user || moodEntries.length === 0) return

    try {
      setError(null)
      // Delete all entries that have an ID
      const entriesWithIds = moodEntries.filter(entry => entry.id !== undefined)
      await Promise.all(entriesWithIds.map(entry => api.deleteMoodEntry(entry.id!)))
      
      // Clear all entries from the list
      setMoodEntries([])
      
      // Reload stats to reflect the deletion
      loadMoodStats()
      
      // Close dialog
      setShowClearAllDialog(false)
    } catch (err) {
      console.error('Failed to delete all mood entries:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete all mood entries')
      setShowClearAllDialog(false)
    }
  }

  const getMoodEmoji = (mood: string) => {
    switch (mood) {
      case "happy":
      case "very_happy":
        return "😊"
      case "neutral":
        return "😐"
      case "sad":
      case "very_sad":
        return "😔"
      default:
        return "❓"
    }
  }

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case "happy":
        return "bg-green-100 text-green-800 border-green-200"
      case "neutral":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "sad":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const chartData = moodEntries.slice(-7).map((entry) => ({
    date: new Date(entry.timestamp).toLocaleDateString("en-US", { weekday: "short" }),
    mood: entry.value,
    fullDate: entry.date,
  }))

  // Calculate average mood score for today only
  const calculateTodayAverageMood = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayEntries = moodEntries.filter(entry => {
      const entryDate = new Date(entry.timestamp)
      entryDate.setHours(0, 0, 0, 0)
      return entryDate.getTime() === today.getTime()
    })
    
    if (todayEntries.length === 0) return "0"
    
    // Use score field if available, otherwise fall back to value
    const scores = todayEntries
      .map(entry => entry.score !== undefined ? entry.score : entry.value)
      .filter(score => score !== null && score !== undefined)
    
    if (scores.length === 0) return "0"
    
    const sum = scores.reduce((acc, score) => acc + score, 0)
    return (sum / scores.length).toFixed(1)
  }

  const averageMood = calculateTodayAverageMood()

  // Calculate consecutive days tracked (longest consecutive sequence)
  const calculateConsecutiveDays = () => {
    if (moodEntries.length === 0) return 0
    
    // Get unique dates (normalized to midnight) from entries
    const uniqueDates = new Set<string>()
    moodEntries.forEach(entry => {
      const entryDate = new Date(entry.timestamp)
      entryDate.setHours(0, 0, 0, 0)
      uniqueDates.add(entryDate.toISOString().split('T')[0]) // Use YYYY-MM-DD format
    })
    
    // Convert to sorted array of dates
    const sortedDates = Array.from(uniqueDates)
      .map(dateStr => new Date(dateStr))
      .sort((a, b) => a.getTime() - b.getTime())
    
    if (sortedDates.length === 0) return 0
    if (sortedDates.length === 1) return 1
    
    // Find longest consecutive sequence
    let maxConsecutive = 1
    let currentConsecutive = 1
    
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1])
      const currDate = new Date(sortedDates[i])
      
      // Calculate difference in days
      const diffTime = currDate.getTime() - prevDate.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 1) {
        // Consecutive day
        currentConsecutive++
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
      } else {
        // Gap found, reset counter
        currentConsecutive = 1
      }
    }
    
    return maxConsecutive
  }

  const streak = calculateConsecutiveDays()

  // Generate week data from mood entries based on selected week start date
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
      
      // Create a date string in YYYY-MM-DD format (no timezone conversion)
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      
      // Create a local date for formatting (no timezone conversion)
      const localDate = new Date(year, month, day)
      
      weekData.push({
        date: dateString,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <NavigationBar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Today's Check-in */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's Mood Check-in */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  <span>How are you feeling today?</span>
                </CardTitle>
                <CardDescription>
                  {selectedMood
                    ? "Add a note about how you're feeling (optional), then click Submit to log your mood."
                    : "Select how you're feeling right now. You can log multiple moods throughout the day."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800/30 rounded text-red-700 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <Button
                      variant={selectedMood === "happy" ? "default" : "outline"}
                      size="lg"
                      onClick={() => selectMood("happy")}
                      className={`h-24 flex-col space-y-2 ${
                        selectedMood === "happy"
                          ? "dark:bg-blue-700 dark:hover:bg-blue-600"
                          : "dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                      }`}
                      disabled={saving || loading}
                    >
                      <span className="text-3xl">😊</span>
                      <span>Great</span>
                    </Button>
                    <Button
                      variant={selectedMood === "neutral" ? "default" : "outline"}
                      size="lg"
                      onClick={() => selectMood("neutral")}
                      className={`h-24 flex-col space-y-2 ${
                        selectedMood === "neutral"
                          ? "dark:bg-blue-700 dark:hover:bg-blue-600"
                          : "dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                      }`}
                      disabled={saving || loading}
                    >
                      <span className="text-3xl">😐</span>
                      <span>Okay</span>
                    </Button>
                    <Button
                      variant={selectedMood === "sad" ? "default" : "outline"}
                      size="lg"
                      onClick={() => selectMood("sad")}
                      className={`h-24 flex-col space-y-2 ${
                        selectedMood === "sad"
                          ? "dark:bg-blue-700 dark:hover:bg-blue-600"
                          : "dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                      }`}
                      disabled={saving || loading}
                    >
                      <span className="text-3xl">😔</span>
                      <span>Tough</span>
                    </Button>
                  </div>

                  {selectedMood && (
                    <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-2xl">{getMoodEmoji(selectedMood)}</span>
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                          You selected: {selectedMood === "happy" ? "Great" : selectedMood === "neutral" ? "Okay" : "Tough"}
                        </span>
                      </div>
                      
                      {/* Score Selection */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          Select your mood score *
                        </label>
                        
                        {/* Mood Score Guide - Number Line */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-2">
                              <span className="font-medium text-red-600 dark:text-red-400">Significantly Irritated</span>
                              <span className="font-medium text-green-600 dark:text-green-400">Significantly Content</span>
                            </div>
                            
                            {/* Number Line */}
                            <div className="relative">
                              {/* Background gradient */}
                              <div className="h-8 rounded-full bg-gradient-to-r from-red-100 via-yellow-100 to-green-100 dark:from-red-900/30 dark:via-yellow-900/30 dark:to-green-900/30"></div>
                              
                              {/* Number markers */}
                              <div className="absolute inset-0 flex items-center justify-between px-1">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                  <div
                                    key={num}
                                    className={`flex flex-col items-center ${
                                      getScoreRange(selectedMood).includes(num)
                                        ? "opacity-100"
                                        : "opacity-40"
                                    }`}
                                  >
                                    <div
                                      className={`w-0.5 h-4 bg-gray-600 dark:bg-gray-400 ${
                                        num === 1 || num === 10 ? "h-6" : ""
                                      }`}
                                    ></div>
                                    <span
                                      className={`text-xs font-medium mt-1 ${
                                        num <= 4
                                          ? "text-red-700 dark:text-red-400"
                                          : num <= 7
                                          ? "text-yellow-700 dark:text-yellow-400"
                                          : "text-green-700 dark:text-green-400"
                                      }`}
                                    >
                                      {num}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              
                              {/* Highlight selected range */}
                              {selectedMood && (
                                <div
                                  className={`absolute top-0 h-8 rounded-full bg-blue-200 dark:bg-blue-800/40 opacity-30 ${
                                    selectedMood === "sad"
                                      ? "left-0 w-[40%]"
                                      : selectedMood === "neutral"
                                      ? "left-[30%] w-[30%]"
                                      : "right-0 w-[30%]"
                                  }`}
                                ></div>
                              )}
                            </div>
                            
                            {/* Range labels */}
                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                              <span>1-4: Tough</span>
                              <span>5-7: Okay</span>
                              <span>8-10: Great</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Score buttons */}
                        <div className="flex flex-wrap gap-2">
                          {getScoreRange(selectedMood).map((score) => (
                            <Button
                              key={score}
                              type="button"
                              variant={moodScore === score ? "default" : "outline"}
                              size="sm"
                              onClick={() => setMoodScore(score)}
                              className={`min-w-[50px] ${
                                moodScore === score 
                                  ? "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600" 
                                  : "hover:bg-blue-100 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                              }`}
                            >
                              {score}
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {selectedMood === "sad" && "Tough mood: Select a score from 1-4"}
                          {selectedMood === "neutral" && "Okay mood: Select a score from 5-7"}
                          {selectedMood === "happy" && "Great mood: Select a score from 8-10"}
                        </p>
                      </div>

                      {/* Date and Time Selection */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          Date & Time <span className="text-red-500 dark:text-red-400">*</span>
                        </label>
                        <div className="flex space-x-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={`flex-1 justify-start text-left font-normal dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 ${
                                  !moodDate ? 'border-red-300 dark:border-red-700' : ''
                                }`}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {moodDate ? (
                                  moodDate.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-500">Select date *</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={moodDate}
                                onSelect={setMoodDate}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <Input
                            type="time"
                            value={moodTime}
                            onChange={(e) => setMoodTime(e.target.value)}
                            placeholder="Time *"
                            className={`w-32 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 ${!moodTime ? 'border-red-300 dark:border-red-700' : ''}`}
                            required
                          />
                        </div>
                        {!moodDate && (
                          <p className="text-xs text-red-500 dark:text-red-400">Date is required</p>
                        )}
                        {moodDate && !moodTime && (
                          <p className="text-xs text-red-500 dark:text-red-400">Time is required</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          Add a note (optional)
                        </label>
                        <Textarea
                          placeholder="What's on your mind? How are you feeling? Any thoughts you'd like to record..."
                          value={moodNote}
                          onChange={(e) => setMoodNote(e.target.value)}
                          rows={4}
                          className="bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          If you don't add a note, "No notes" will be saved with your mood entry.
                        </p>
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          onClick={submitMood}
                          disabled={saving || loading || !moodScore || !moodDate || !moodTime}
                          className="flex-1 dark:bg-blue-700 dark:hover:bg-blue-600"
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            "Submit Mood Entry"
                          )}
                        </Button>
                        <Button
                          onClick={cancelMoodSelection}
                          variant="outline"
                          disabled={saving || loading}
                          className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {saving && !selectedMood && (
                    <div className="flex items-center justify-center text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving mood entry...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Mood Trends Chart */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                      <span>Mood Trends & Analysis</span>
                    </CardTitle>
                    <CardDescription>Track your emotional patterns and insights</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-[200px] justify-start text-left font-normal">
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
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Loader2 className="h-12 w-12 mx-auto mb-4 text-gray-300 animate-spin" />
                      <p>Loading mood data...</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Week Range Display */}
                    <div className="text-sm text-gray-600 text-center">
                      Showing week: {weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {' '}
                      {(() => {
                        const weekEnd = new Date(weekStartDate)
                        weekEnd.setDate(weekStartDate.getDate() + 6)
                        return weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      })()}
                    </div>
                    
                    {/* Chart */}
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
                            interval={0}
                            allowDecimals={false}
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

                    {/* Week Summary */}
                    {weekChartData.some(d => d.average !== null) && (
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {(() => {
                              const scores = weekChartData
                                .map(d => d.average)
                                .filter((score): score is number => score !== null)
                              if (scores.length === 0) return '—'
                              const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length
                              return avg.toFixed(1)
                            })()}
                          </div>
                          <p className="text-xs text-gray-600">Week Avg</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">
                            {(() => {
                              const scores = weekChartData
                                .map(d => d.average)
                                .filter((score): score is number => score !== null)
                              if (scores.length === 0) return '—'
                              return Math.max(...scores).toFixed(1)
                            })()}
                          </div>
                          <p className="text-xs text-gray-600">Highest</p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {(() => {
                              const scores = weekChartData
                                .map(d => d.average)
                                .filter((score): score is number => score !== null)
                              if (scores.length === 0) return '—'
                              return Math.min(...scores).toFixed(1)
                            })()}
                          </div>
                          <p className="text-xs text-gray-600">Lowest</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Journal Entries */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5 text-purple-500" />
                    <span>Journal Entries</span>
                  </CardTitle>
                  {moodEntries.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowClearAllDialog(true)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove All Entries
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {moodEntries
                    .slice(0, 10) // Show last 10 entries (already sorted newest first)
                    .map((entry, index) => (
                      <div key={entry.id || index} className="border-l-4 border-blue-200 dark:border-blue-800 pl-4 py-2 group hover:bg-gray-50 dark:hover:bg-gray-800 rounded-r transition-colors">
                        {editingEntryId === entry.id ? (
                          // Edit mode
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(entry.timestamp).toLocaleDateString()} at {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mood:</label>
                                <div className="flex space-x-2">
                                  {["happy", "neutral", "sad"].map((mood) => (
                                    <button
                                      key={mood}
                                      type="button"
                                      onClick={() => {
                                        setEditMood(mood)
                                        // Reset score if it doesn't match the new mood
                                        if (editScore !== null) {
                                          const validScores = getScoreRange(mood)
                                          if (!validScores.includes(editScore)) {
                                            setEditScore(null)
                                          }
                                        }
                                      }}
                                      className={`p-2 rounded-lg transition-colors ${
                                        editMood === mood
                                          ? "bg-blue-100 dark:bg-blue-900"
                                          : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                                      }`}
                                    >
                                      <span className="text-lg">{getMoodEmoji(mood)}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Score:</label>
                                <div className="flex flex-wrap gap-2">
                                  {getScoreRange(editMood).map((score) => (
                                    <Button
                                      key={score}
                                      type="button"
                                      variant={editScore === score ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => setEditScore(score)}
                                      className={`min-w-[50px] ${
                                        editScore === score 
                                          ? "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600" 
                                          : "hover:bg-blue-100 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                                      }`}
                                    >
                                      {score}
                                    </Button>
                                  ))}
                                </div>
                                <span className="text-sm text-gray-500">/10</span>
                              </div>
                              {editMood && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {editMood === "sad" && "Tough mood: Select a score from 1-4"}
                                  {editMood === "neutral" && "Okay mood: Select a score from 5-7"}
                                  {editMood === "happy" && "Great mood: Select a score from 8-10"}
                                </p>
                              )}
                              <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Note:</label>
                                <Textarea
                                  value={editNote}
                                  onChange={(e) => setEditNote(e.target.value)}
                                  placeholder="Add a note..."
                                  className="min-h-[80px]"
                                />
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                onClick={saveEdit}
                                disabled={savingEdit || !editMood}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                {savingEdit ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4 mr-2" />
                                )}
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditing}
                                disabled={savingEdit}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // View mode
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-lg">{getMoodEmoji(entry.mood)}</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {new Date(entry.timestamp).toLocaleDateString()} at {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {entry.score && (
                                  <Badge variant="outline" className="ml-2">
                                    Score: {entry.score}/10
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{entry.note}</p>
                            </div>
                            {entry.id && (
                              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEditing(entry)}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  title="Edit this mood entry"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDeleteDialog(entry.id!)}
                                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  title="Delete this mood entry"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  {moodEntries.length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      No journal entries yet. Start logging your moods to see them here!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Stats & History */}
          <div className="space-y-6">
            {/* Mood Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Mood Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{averageMood}</div>
                  <p className="text-sm text-gray-600">Average Mood Score</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{streak}</div>
                  <p className="text-sm text-gray-600">Days Tracked</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl">
                    {moodEntries.length > 0
                      ? getMoodEmoji(moodEntries[0].mood)
                      : "❓"}
                  </div>
                  <p className="text-sm text-gray-600">Latest Mood</p>
                </div>
              </CardContent>
            </Card>

            {/* Mood History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CalendarIcon className="h-5 w-5 text-purple-500" />
                  <span>Recent History</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {moodEntries
                    .slice(0, 3) // Show last 3 entries (already sorted newest first)
                    .map((entry, index) => (
                      <div key={entry.id || index} className="flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded transition-colors">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <span className="text-xl">{getMoodEmoji(entry.mood)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {new Date(entry.timestamp).toLocaleDateString()} at {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {entry.score && (
                                <Badge variant="outline" className="text-xs">
                                  {entry.score}/10
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-32">{entry.note}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getMoodColor(entry.mood)}>{entry.mood}</Badge>
                          {entry.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(entry.id!)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 w-8 p-0"
                              title="Delete this mood entry"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  {moodEntries.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No mood entries yet. Start tracking today!</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Wellness Tips */}
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200 dark:from-green-900/20 dark:to-blue-900/20 dark:border-green-800/30">
              <CardHeader>
                <CardTitle className="text-green-800 dark:text-green-300">💡 Wellness Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-green-700 dark:text-green-300">
                  <p>• Take 5 deep breaths when feeling overwhelmed</p>
                  <p>• Go for a short walk to boost your mood</p>
                  <p>• Practice gratitude by listing 3 good things daily</p>
                  <p>• Stay hydrated and get enough sleep</p>
                  <p>• Connect with friends or family when feeling down</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <AlertDialogTitle>Delete Mood Entry?</AlertDialogTitle>
                <AlertDialogDescription className="mt-2">
                  Are you sure you want to delete this mood entry? This action cannot be undone and the entry will be permanently removed from your mood log.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false)
              setEntryToDelete(null)
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteMoodEntry}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete Entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Journal Entries Confirmation Dialog */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <AlertDialogTitle>Remove All Journal Entries?</AlertDialogTitle>
                <AlertDialogDescription className="mt-2">
                  Are you sure you want to delete all mood entries? This action cannot be undone. All {moodEntries.length} journal entr{moodEntries.length !== 1 ? 'ies' : 'y'} will be permanently removed from your mood log.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAllMoodEntries}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete All Entries
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
