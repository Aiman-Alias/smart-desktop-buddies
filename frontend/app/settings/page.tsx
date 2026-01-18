"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Settings, User, Palette, Shield, Download, Trash2, Calendar, RefreshCw, Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react"
import { jsPDF } from "jspdf"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { api, CalendarConnection } from "@/lib/api"
import { useTheme } from "next-themes"
import { useToast } from "@/hooks/use-toast"
import { NavigationBar } from "@/components/navigation-bar"
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

interface Preferences {
  theme: string
  buddyName: string
  buddyAppearance: string
}

export default function SettingsPage() {
  const { user, setUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [preferences, setPreferences] = useState<Preferences>({
    theme: "light",
    buddyName: "Buddy",
    buddyAppearance: "owl",
  })
  const [originalPreferences, setOriginalPreferences] = useState<Preferences>({
    theme: "light",
    buddyName: "Buddy",
    buddyAppearance: "owl",
  })
  const [username, setUsername] = useState(user?.username || "")
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [calendarConnections, setCalendarConnections] = useState<CalendarConnection[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState<number | null>(null) // connection ID being synced
  const [showClearDataDialog, setShowClearDataDialog] = useState(false)
  const [showResetSettingsDialog, setShowResetSettingsDialog] = useState(false)
  const [clearingData, setClearingData] = useState(false)
  const [exportingData, setExportingData] = useState(false)
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)
  const [connectionToDisconnect, setConnectionToDisconnect] = useState<number | null>(null)
  const [showNavigationDialog, setShowNavigationDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const isNavigatingProgrammatically = useRef(false)
  const router = useRouter()
  const isInitialLoad = useRef(true)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showPasswordChange, setShowPasswordChange] = useState(false)

  // Sync theme from next-themes to preferences (only on initial load)
  useEffect(() => {
    if (theme && isInitialLoad.current) {
      setPreferences(prev => ({ ...prev, theme: theme as "light" | "dark" }))
      setOriginalPreferences(prev => ({ ...prev, theme: theme as "light" | "dark" }))
      isInitialLoad.current = false
    }
  }, [theme])

  // Sync username when user changes
  useEffect(() => {
    if (user?.username) {
      setUsername(user.username)
    }
  }, [user?.username])

  useEffect(() => {
    if (!user) return
    
    // Set username from user
    setUsername(user.username || "")
    
    // Get user-specific preference key
    const preferenceKey = `smartBuddyPreferences_${user.id}`
    const lastUserIdKey = "smartBuddyLastUserId"
    
    // Check if this is a different user - if so, clear old preferences
    const lastUserId = localStorage.getItem(lastUserIdKey)
    if (lastUserId && lastUserId !== String(user.id)) {
      // Different user logged in - clear old global preferences and use defaults
      localStorage.removeItem("smartBuddyPreferences")
      const defaultPreferences = {
        theme: "light",
        buddyName: "Buddy",
        buddyAppearance: "owl",
      }
      setPreferences(defaultPreferences)
      setOriginalPreferences(defaultPreferences)
      setTheme("light")
      // Save new user's default preferences
      localStorage.setItem(preferenceKey, JSON.stringify(defaultPreferences))
      localStorage.setItem(lastUserIdKey, String(user.id))
      return
    }
    
    // Store current user ID
    localStorage.setItem(lastUserIdKey, String(user.id))
    
    // Load preferences from user-specific localStorage
    const savedPreferences = localStorage.getItem(preferenceKey)
    if (savedPreferences) {
      try {
        const parsed = JSON.parse(savedPreferences)
        // Prioritize saved theme, fallback to current theme or default
        const loadedTheme = parsed.theme || theme || "light"
        const loadedPreferences = { ...parsed, theme: loadedTheme }
        setPreferences(loadedPreferences)
        setOriginalPreferences(loadedPreferences) // Store original preferences
        // Sync theme to next-themes if saved theme is different
        if (parsed.theme && parsed.theme !== theme) {
          setTheme(parsed.theme)
        }
      } catch (error) {
        console.error('Error loading preferences:', error)
        const defaultPreferences = {
          theme: theme || "light",
          buddyName: "Buddy",
          buddyAppearance: "owl",
        }
        setPreferences(defaultPreferences)
        setOriginalPreferences(defaultPreferences)
      }
    } else {
      // If no saved preferences, use defaults
      const defaultPreferences = {
        theme: theme || "light",
        buddyName: "Buddy",
        buddyAppearance: "owl",
      }
      setPreferences(defaultPreferences)
      setOriginalPreferences(defaultPreferences)
      // Save defaults for this user
      localStorage.setItem(preferenceKey, JSON.stringify(defaultPreferences))
    }
    
    // Load calendar connections
    loadCalendarConnections()
    
    // Check for OAuth callback success/error in URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const calendarConnected = urlParams.get('calendar_connected')
      const calendarError = urlParams.get('calendar_error')
      
      if (calendarConnected === 'true') {
        // Reload connections after successful OAuth
        setTimeout(() => {
          loadCalendarConnections()
          // Remove query param
          router.replace('/settings')
        }, 1000)
      } else if (calendarError) {
        toast({
          title: "Calendar Connection Error",
          description: calendarError,
          variant: "destructive",
        })
        router.replace('/settings')
      }

      // Scroll to calendar section if hash is present
      if (window.location.hash === '#calendar-integration') {
        setTimeout(() => {
          const element = document.getElementById('calendar-integration')
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' })
            // Remove hash from URL after scrolling
            window.history.replaceState(null, '', '/settings')
          }
        }, 100)
      }
    }
  }, [user, router])

  // Prevent navigation when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChanges) {
        e.preventDefault()
        e.returnValue = '' // Chrome requires returnValue to be set
        return '' // Some browsers require a return value
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [unsavedChanges])

  // Intercept browser back/forward button navigation
  useEffect(() => {
    if (!unsavedChanges) return

    // Push a state to the history stack so we can intercept back button
    const currentPath = window.location.pathname + window.location.search
    window.history.pushState({ preventBack: true }, '', currentPath)

    const handlePopState = (e: PopStateEvent) => {
      // Don't intercept if we're navigating programmatically
      if (isNavigatingProgrammatically.current) {
        return
      }

      if (unsavedChanges) {
        // Prevent the navigation temporarily
        window.history.pushState({ preventBack: true }, '', currentPath)
        
        // Show the navigation dialog
        setPendingNavigation(null) // We don't know the exact destination for back button
        setShowNavigationDialog(true)
      }
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      // Clean up the extra history state if component unmounts
      if (window.history.state?.preventBack) {
        window.history.back()
      }
    }
  }, [unsavedChanges])

  // Intercept all link clicks when there are unsaved changes
  useEffect(() => {
    if (!unsavedChanges) return

    const handleLinkClick = (e: MouseEvent) => {
      // Don't intercept if we're navigating programmatically
      if (isNavigatingProgrammatically.current) {
        return
      }

      const target = e.target as HTMLElement
      const link = target.closest('a[href]')
      
      // Don't intercept if clicking on buttons or non-navigation links
      if (!link || link.getAttribute('href')?.startsWith('#') || target.closest('button')) {
        return
      }

      // Don't intercept if it's a calendar OAuth redirect or external link
      const href = link.getAttribute('href')
      if (!href || href.includes('accounts.google.com') || href.startsWith('http')) {
        return
      }

      // Don't intercept if clicking on the same page
      if (href === '/settings' || href === window.location.pathname) {
        return
      }

      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      
      setPendingNavigation(href)
      setShowNavigationDialog(true)
    }

    // Use capture phase to catch events before they reach Next.js Link handler
    document.addEventListener('click', handleLinkClick, true)

    return () => {
      document.removeEventListener('click', handleLinkClick, true)
    }
  }, [unsavedChanges])

  const loadCalendarConnections = async () => {
    if (!user) return
    setCalendarLoading(true)
    try {
      const connections = await api.getCalendarConnections()
      setCalendarConnections(connections)
    } catch (error) {
      console.error('Failed to load calendar connections:', error)
      // Don't show error to user if it's just that no connections exist
      // The error will be visible in console for debugging
      setCalendarConnections([])
    } finally {
      setCalendarLoading(false)
    }
  }

  const handleConnectGoogle = async () => {
    try {
      const result = await api.connectGoogleCalendar()
      // Redirect to Google OAuth
      window.location.href = result.authorization_url
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : 'Failed to connect Google Calendar',
        variant: "destructive",
      })
    }
  }

  const handleDisconnect = (connectionId: number) => {
    setConnectionToDisconnect(connectionId)
    setShowDisconnectDialog(true)
  }

  const confirmDisconnect = async () => {
    if (connectionToDisconnect === null) return
    
    try {
      await api.disconnectCalendar(connectionToDisconnect)
      await loadCalendarConnections()
      setShowDisconnectDialog(false)
      setConnectionToDisconnect(null)
      toast({
        title: "Calendar Disconnected",
        description: "The calendar has been successfully disconnected.",
      })
    } catch (error) {
      toast({
        title: "Disconnect Failed",
        description: error instanceof Error ? error.message : 'Failed to disconnect calendar',
        variant: "destructive",
      })
      setShowDisconnectDialog(false)
      setConnectionToDisconnect(null)
    }
  }

  const handleSync = async (connectionId?: number) => {
    setSyncLoading(connectionId || -1) // -1 means sync all
    try {
      const result = await api.syncCalendar(connectionId)
      await loadCalendarConnections()
      const syncedCount = result.synced || 0
      const createdCount = result.created || 0
      const updatedCount = result.updated || 0
      
      let description = `${syncedCount} events synced`
      if (createdCount > 0 || updatedCount > 0) {
        description += ` (${createdCount} new, ${updatedCount} updated)`
      }
      description += `. Sync includes events from now up to 30 days ahead.`
      
      toast({
        title: "Sync Completed",
        description: description,
        variant: "default",
      })
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : 'Failed to sync calendar',
        variant: "destructive",
      })
    } finally {
      setSyncLoading(null)
    }
  }

  const updatePreference = (key: keyof Preferences, value: any) => {
    const updatedPreferences = { ...preferences, [key]: value }
    setPreferences(updatedPreferences)
    setUnsavedChanges(true)
    
    // Don't save to localStorage immediately - wait for "Save Changes"
    // localStorage.setItem("smartBuddyPreferences", JSON.stringify(updatedPreferences))
    
    // If theme is being updated, also update next-themes (for preview)
    if (key === "theme") {
      setTheme(value)
    }
  }

  const saveSettings = () => {
    if (!user) return
    // Save preferences to user-specific localStorage
    const preferenceKey = `smartBuddyPreferences_${user.id}`
    localStorage.setItem(preferenceKey, JSON.stringify(preferences))
    setOriginalPreferences(preferences) // Update original preferences after saving
    setUnsavedChanges(false)
    toast({
      title: "Settings Saved",
      description: "Your preferences have been saved successfully.",
    })
  }

  const cancelChanges = () => {
    // Restore original preferences
    setPreferences(originalPreferences)
    // Restore theme if it was changed
    if (originalPreferences.theme !== preferences.theme) {
      setTheme(originalPreferences.theme)
    }
    setUnsavedChanges(false)
    toast({
      title: "Changes Cancelled",
      description: "Your unsaved changes have been discarded.",
    })
  }

  const handleNavigationSave = () => {
    const navTarget = pendingNavigation
    setPendingNavigation(null)
    setShowNavigationDialog(false)
    
    // Save settings first
    saveSettings()
    
    // Mark that we're navigating programmatically to bypass the navigation guard
    isNavigatingProgrammatically.current = true
    
    // Use setTimeout to ensure state updates (unsavedChanges = false) complete before navigation
    setTimeout(() => {
      if (navTarget) {
        router.push(navTarget)
      } else {
        // If no pending navigation (back button), allow the back navigation
        window.history.back()
      }
      // Reset the flag after navigation
      setTimeout(() => {
        isNavigatingProgrammatically.current = false
      }, 500)
    }, 100)
  }

  const handleNavigationDiscard = () => {
    const navTarget = pendingNavigation
    setPendingNavigation(null)
    setShowNavigationDialog(false)
    
    // Cancel changes first
    cancelChanges()
    
    // Mark that we're navigating programmatically to bypass the navigation guard
    isNavigatingProgrammatically.current = true
    
    // Use setTimeout to ensure state updates (unsavedChanges = false) complete before navigation
    setTimeout(() => {
      if (navTarget) {
        router.push(navTarget)
      } else {
        // If no pending navigation (back button), allow the back navigation
        window.history.back()
      }
      // Reset the flag after navigation
      setTimeout(() => {
        isNavigatingProgrammatically.current = false
      }, 500)
    }, 100)
  }

  const handleNavigationCancel = () => {
    setShowNavigationDialog(false)
    setPendingNavigation(null)
    // Push state again to prevent navigation
    const currentPath = window.location.pathname + window.location.search
    window.history.pushState({ preventBack: true }, '', currentPath)
  }


  const handleUpdateUsername = async () => {
    if (!user || !username.trim() || username === user.username) return
    
    setUsernameLoading(true)
    try {
      const updatedUser = await api.updateProfile(username.trim())
      // Update user in auth context
      if (setUser && updatedUser) {
        setUser({ ...user, username: updatedUser.username || username.trim() })
      } else if (setUser) {
        // Fallback: update with the new username
        setUser({ ...user, username: username.trim() })
      }
      toast({
        title: "Username Updated",
        description: "Your username has been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : 'Failed to update username',
        variant: "destructive",
      })
    } finally {
      setUsernameLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Please fill in all password fields.",
        variant: "destructive",
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirm password do not match.",
        variant: "destructive",
      })
      return
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      })
      return
    }

    // Check if password is entirely numeric
    if (/^\d+$/.test(newPassword)) {
      toast({
        title: "Invalid Password",
        description: "Password cannot be entirely numeric.",
        variant: "destructive",
      })
      return
    }

    // Check if password is too similar to username or email
    const usernameLower = (user?.username || '').toLowerCase()
    const emailLower = (user?.email || '').toLowerCase()
    const passwordLower = newPassword.toLowerCase()
    
    if (usernameLower && passwordLower.includes(usernameLower) && usernameLower.length >= 3) {
      toast({
        title: "Invalid Password",
        description: "Password cannot be too similar to your username.",
        variant: "destructive",
      })
      return
    }
    
    if (emailLower && passwordLower.includes(emailLower.split('@')[0]) && emailLower.split('@')[0].length >= 3) {
      toast({
        title: "Invalid Password",
        description: "Password cannot be too similar to your email.",
        variant: "destructive",
      })
      return
    }

    setPasswordLoading(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      toast({
        title: "Password Changed",
        description: "Your password has been changed successfully.",
      })
      // Clear form
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setShowPasswordChange(false)
    } catch (error) {
      toast({
        title: "Password Change Failed",
        description: error instanceof Error ? error.message : 'Failed to change password',
        variant: "destructive",
      })
    } finally {
      setPasswordLoading(false)
    }
  }

  const resetSettings = () => {
    setShowResetSettingsDialog(true)
  }

  const confirmResetSettings = async () => {
    try {
      // 1. Disconnect all calendar connections
      try {
        const connections = await api.getCalendarConnections()
        for (const conn of connections) {
          try {
            await api.disconnectCalendar(conn.id)
          } catch (error) {
            console.error(`Error disconnecting calendar ${conn.id}:`, error)
          }
        }
        // Reload calendar connections to reflect changes
        await loadCalendarConnections()
      } catch (error) {
        console.error('Error getting calendar connections:', error)
      }

      // 2. Reset preferences to defaults
      if (!user) return
      const defaultPreferences = {
        theme: "light",
        buddyName: "Buddy",
        buddyAppearance: "owl",
      }
      setPreferences(defaultPreferences)
      setOriginalPreferences(defaultPreferences) // Update original to match, so no unsaved changes
      // Save to user-specific localStorage
      const preferenceKey = `smartBuddyPreferences_${user.id}`
      localStorage.setItem(preferenceKey, JSON.stringify(defaultPreferences))
      // Also reset the actual theme in next-themes
      setTheme("light")
      setUnsavedChanges(false) // No unsaved changes since we've saved the defaults
      setShowResetSettingsDialog(false)
      toast({
        title: "Settings Reset",
        description: "All settings have been reset to default values and calendar connections have been removed.",
      })
    } catch (error) {
      console.error('Error resetting settings:', error)
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : 'Failed to reset settings. Please try again.',
        variant: "destructive",
      })
      setShowResetSettingsDialog(false)
    }
  }

  const exportData = async () => {
    if (!user) return
    
    setExportingData(true)
    try {
      // Fetch all data from backend
      const [tasks, moodEntries, chatMessages, analytics] = await Promise.all([
        api.getTasks().catch(() => []),
        api.getMoodEntries().catch(() => []),
        api.getChatMessages().catch(() => []),
        api.getAnalytics(90).catch(() => ({ daily_data: [] })),
      ])

      // Helper function to remove emojis and clean text
      const cleanText = (text: string): string => {
        if (!text) return ''
        // Remove emojis and special unicode characters
        return text
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Emojis
          .replace(/[\u{2600}-\u{26FF}]/gu, '') // Miscellaneous symbols
          .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
          .replace(/[\u{FE00}-\u{FE0F}]/gu, '') // Variation selectors
          .replace(/[\u{200D}]/gu, '') // Zero width joiner
          .replace(/[\u{200B}]/gu, '') // Zero width space
          .replace(/\s+/g, ' ') // Multiple spaces to single space
          .trim()
      }

      // Helper function to clean markdown formatting
      const cleanMarkdown = (text: string): string => {
        if (!text) return ''
        return text
          .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
          .replace(/\*(.*?)\*/g, '$1') // Italic
          .replace(/#{1,6}\s*(.*)/g, '$1') // Headers
          .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links
          .replace(/`([^`]+)`/g, '$1') // Code
          .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double
          .trim()
      }

      // Create PDF
      const doc = new jsPDF()
      let yPosition = 20
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 20
      const maxWidth = pageWidth - (margin * 2)
      const lineHeight = 7

      // Helper function to add a new page if needed
      const checkNewPage = (requiredSpace: number = lineHeight) => {
        if (yPosition + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage()
          yPosition = 20
          return true
        }
        return false
      }

      // Helper function to add a horizontal line
      const addLine = () => {
        checkNewPage(5)
        doc.setDrawColor(200, 200, 200)
        doc.line(margin, yPosition, pageWidth - margin, yPosition)
        yPosition += 5
      }

      // Helper function to add text with word wrapping
      const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: number[] = [0, 0, 0]) => {
        if (!text) return
        const cleanContent = cleanText(String(text))
        if (!cleanContent) return
        
        checkNewPage(fontSize + 2)
        doc.setFontSize(fontSize)
        doc.setTextColor(color[0], color[1], color[2])
        if (isBold) {
          doc.setFont(undefined, 'bold')
        } else {
          doc.setFont(undefined, 'normal')
        }
        
        const lines = doc.splitTextToSize(cleanContent, maxWidth) as string[]
        lines.forEach((line: string) => {
          checkNewPage(fontSize + 2)
          doc.text(line, margin, yPosition)
          yPosition += fontSize + 2
        })
      }

      // Title
      addText("Smart Desktop Buddies - User Data Export", 18, true, [0, 0, 0])
      yPosition += 5

      // User Information
      addText("User Information", 14, true, [0, 51, 102])
      yPosition += 3
      addText(`Username: ${user.username}`, 11)
      addText(`Email: ${user.email}`, 11)
      addText(`Export Date: ${new Date().toLocaleString()}`, 10, false, [128, 128, 128])
      yPosition += 4
      addLine()

      // Tasks Section
      addText("Tasks", 14, true, [0, 51, 102])
      yPosition += 3
      if (tasks.length === 0) {
        addText("No tasks found.", 10, false, [128, 128, 128])
      } else {
        addText(`Total Tasks: ${tasks.length}`, 11)
        yPosition += 2
        tasks.forEach((task: any, index: number) => {
          checkNewPage(25)
          addText(`${index + 1}. ${task.title}`, 11, true)
          if (task.description) {
            addText(`   Description: ${cleanText(task.description)}`, 10)
          }
          addText(`   Priority: ${task.priority || 'N/A'} | Status: ${task.status || 'N/A'}`, 10, false, [128, 128, 128])
          if (task.due_date) {
            addText(`   Due Date: ${new Date(task.due_date).toLocaleString()}`, 10, false, [128, 128, 128])
          }
          yPosition += 2
        })
      }
      yPosition += 4
      addLine()

      // Mood Logs Section
      addText("Mood Logs", 14, true, [0, 51, 102])
      yPosition += 3
      if (moodEntries.length === 0) {
        addText("No mood entries found.", 10, false, [128, 128, 128])
      } else {
        addText(`Total Mood Entries: ${moodEntries.length}`, 11)
        yPosition += 2
        
        // Group by date for better organization
        const moodByDate: { [key: string]: any[] } = {}
        moodEntries.forEach((entry: any) => {
          const date = new Date(entry.created_at).toLocaleDateString()
          if (!moodByDate[date]) {
            moodByDate[date] = []
          }
          moodByDate[date].push(entry)
        })

        Object.keys(moodByDate).sort().reverse().forEach((date) => {
          checkNewPage(15)
          addText(`Date: ${date}`, 11, true)
          moodByDate[date].forEach((entry: any) => {
            const time = new Date(entry.created_at).toLocaleTimeString()
            const moodLabel = entry.mood.charAt(0).toUpperCase() + entry.mood.slice(1).replace('_', ' ')
            
            // Extract score from note if available
            let scoreText = ''
            if (entry.note && entry.note.includes('SCORE:')) {
              const scoreMatch = entry.note.match(/SCORE:(\d+)/)
              if (scoreMatch) {
                scoreText = ` (Score: ${scoreMatch[1]}/10)`
              }
            }
            
            addText(`   ${time} - ${moodLabel}${scoreText}`, 10)
            if (entry.note && !entry.note.includes('SCORE:')) {
              const cleanNote = cleanText(entry.note)
              if (cleanNote) {
                addText(`   Note: ${cleanNote}`, 9, false, [128, 128, 128])
              }
            } else if (entry.note && entry.note.includes('SCORE:')) {
              const cleanNote = cleanText(entry.note.replace(/SCORE:\d+\|?/, '').trim())
              if (cleanNote) {
                addText(`   Note: ${cleanNote}`, 9, false, [128, 128, 128])
              }
            }
          })
          yPosition += 1
        })
      }
      yPosition += 4
      addLine()

      // Chat History Section
      addText("AI Chatbot History", 14, true, [0, 51, 102])
      yPosition += 3
      if (chatMessages.length === 0) {
        addText("No chat messages found.", 10, false, [128, 128, 128])
      } else {
        addText(`Total Messages: ${chatMessages.length}`, 11)
        yPosition += 2
        chatMessages.forEach((message: any, index: number) => {
          checkNewPage(25)
          const date = new Date(message.created_at).toLocaleString()
          const role = message.role === 'user' ? 'You' : 'AI Assistant'
          addText(`${index + 1}. [${date}] ${role}:`, 10, true)
          
          // Clean and format message content
          let cleanContent = cleanMarkdown(message.content)
          cleanContent = cleanText(cleanContent)
          
          // Split into paragraphs for better readability
          const paragraphs = cleanContent.split(/\n\n+/)
          paragraphs.forEach((paragraph: string, pIndex: number) => {
            if (paragraph.trim()) {
              addText(paragraph.trim(), 10)
              // Only add extra space between paragraphs (not after each sentence)
              if (pIndex < paragraphs.length - 1 && paragraphs.length > 1) {
                yPosition += 1
              }
            }
          })
          yPosition += 1
        })
      }
      yPosition += 4
      addLine()

      // Analytics Section
      addText("Analytics Summary", 14, true, [0, 51, 102])
      yPosition += 3
      if (analytics.daily_data && analytics.daily_data.length > 0) {
        // Check for both camelCase and snake_case field names
        // Note: focusTime is already in minutes from the backend
        const totalFocusTime = analytics.daily_data.reduce((sum: number, day: any) => {
          const focusTime = day.focusTime || day.total_focus_time || 0
          // If it's in seconds, convert to minutes; otherwise use as-is
          return sum + (focusTime > 1000 ? Math.round(focusTime / 60) : focusTime)
        }, 0)
        const totalTasksCompleted = analytics.daily_data.reduce((sum: number, day: any) => {
          const tasksCompleted = day.tasksCompleted || day.tasks_completed || 0
          return sum + tasksCompleted
        }, 0)
        const avgFocusTime = totalFocusTime / analytics.daily_data.length
        const avgTasksCompleted = totalTasksCompleted / analytics.daily_data.length
        
        addText(`Total Focus Time: ${Math.round(totalFocusTime)} minutes`, 11)
        addText(`Average Focus Time per Day: ${Math.round(avgFocusTime)} minutes`, 11)
        addText(`Total Tasks Completed: ${totalTasksCompleted}`, 11)
        addText(`Average Tasks Completed per Day: ${avgTasksCompleted.toFixed(1)}`, 11)
      } else {
        addText("No analytics data available.", 10, false, [128, 128, 128])
      }

      // Footer
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(128, 128, 128)
        doc.text(
          `Page ${i} of ${totalPages} - Generated by Smart Desktop Buddies`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        )
      }

      // Save PDF
      const fileName = `smart-buddy-data-${user.username}-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
      
      toast({
        title: "Export Successful",
        description: "Your data has been exported successfully as PDF.",
      })
    } catch (error) {
      console.error('Error exporting data:', error)
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : 'Failed to export data. Please try again.',
        variant: "destructive",
      })
    } finally {
      setExportingData(false)
    }
  }

  const clearAllData = async () => {
    if (!user) return
    
    setClearingData(true)
    try {
      // Clear all backend data
      // 1. Delete all tasks
      try {
        const tasks = await api.getTasks()
        await Promise.all(tasks.map(task => api.deleteTask(task.id)))
      } catch (error) {
        console.error('Error deleting tasks:', error)
      }

      // 2. Delete all mood entries
      try {
        const moodEntries = await api.getMoodEntries()
        await Promise.all(moodEntries.map(entry => api.deleteMoodEntry(entry.id)))
      } catch (error) {
        console.error('Error deleting mood entries:', error)
      }

      // 2.5. Delete all chat messages
      try {
        const chatMessages = await api.getChatMessages()
        await Promise.all(chatMessages.map((msg: any) => api.deleteChatMessage(msg.id)))
      } catch (error) {
        console.error('Error deleting chat messages:', error)
      }

      // 3. Delete all focus sessions
      try {
        const focusSessions = await api.getFocusSessions()
        await Promise.all(focusSessions.map((session: any) => api.deleteFocusSession(session.id)))
      } catch (error) {
        console.error('Error deleting focus sessions:', error)
      }

      // 4. Disconnect all calendar connections
      try {
        const connections = await api.getCalendarConnections()
        for (const conn of connections) {
          try {
            await api.disconnectCalendar(conn.id)
          } catch (error) {
            console.error(`Error disconnecting calendar ${conn.id}:`, error)
          }
        }
      } catch (error) {
        console.error('Error getting calendar connections:', error)
      }

      // 5. Clear localStorage
      localStorage.removeItem("smartBuddyTasks")
      localStorage.removeItem("smartBuddyMoodHistory")
      localStorage.removeItem("smartBuddyMindfulnessSessions")
      localStorage.removeItem("smartBuddyTodayMood")
      
      // Clear user-specific mindfulness sessions
      const mindfulnessKey = `mindfulnessSessions_${user.id}`
      localStorage.removeItem(mindfulnessKey)

      // 6. Reset settings to defaults
      if (!user) return
      const defaultPreferences = {
        theme: "light",
        buddyName: "Buddy",
        buddyAppearance: "owl",
      }
      setPreferences(defaultPreferences)
      const preferenceKey = `smartBuddyPreferences_${user.id}`
      localStorage.setItem(preferenceKey, JSON.stringify(defaultPreferences))
      setTheme("light")

      setShowClearDataDialog(false)
      toast({
        title: "Data Cleared",
        description: "All data has been cleared successfully! Your account is now reset to a fresh state.",
      })
      
      // Reload the page to reflect changes
      window.location.reload()
    } catch (error) {
      console.error('Error clearing data:', error)
      toast({
        title: "Clear Failed",
        description: error instanceof Error ? error.message : 'Failed to clear all data. Please try again.',
        variant: "destructive",
      })
    } finally {
      setClearingData(false)
    }
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <NavigationBar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section with Sticky Buttons */}
        {unsavedChanges && (
          <div className="sticky top-4 z-50 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-orange-800 dark:text-orange-300">Unsaved Changes</h3>
                <p className="text-sm text-orange-600 dark:text-orange-400">You have unsaved changes. Don't forget to save!</p>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={cancelChanges}>
                  Cancel
                </Button>
                <Button onClick={saveSettings}>Save Changes</Button>
              </div>
            </div>
          </div>
        )}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Settings
            </h1>
          </div>
        </div>
        <div className="space-y-8">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5 text-blue-500" />
                <span>Profile Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={usernameLoading}
                    />
                    <Button
                      onClick={handleUpdateUsername}
                      disabled={usernameLoading || !username.trim() || username === user?.username}
                      size="default"
                    >
                      {usernameLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Update"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">You can change your username</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user.email}
                    disabled
                  />
                  <p className="text-xs text-gray-500">Email cannot be changed</p>
                </div>
              </div>
              
              {/* Password Change Section */}
              <div className="pt-6 border-t">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label className="text-base font-semibold">Change Password</Label>
                    <p className="text-xs text-gray-500 mt-1">Update your account password</p>
                  </div>
                  <Button
                    variant={showPasswordChange ? "outline" : "default"}
                    onClick={() => {
                      setShowPasswordChange(!showPasswordChange)
                      if (showPasswordChange) {
                        // Clear form when hiding
                        setCurrentPassword("")
                        setNewPassword("")
                        setConfirmPassword("")
                      }
                    }}
                  >
                    {showPasswordChange ? "Cancel" : "Change Password"}
                  </Button>
                </div>
                
                {showPasswordChange && (
                  <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={passwordLoading}
                        placeholder="Enter your current password"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        disabled={passwordLoading}
                        placeholder="Enter your new password"
                      />
                      <div className="text-xs text-gray-500 space-y-1">
                        <p className="font-semibold text-gray-700 dark:text-gray-300">Password Requirements:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-gray-600 dark:text-gray-400">
                          <li>At least 8 characters long</li>
                          <li>Cannot be too similar to your username or email</li>
                          <li>Cannot be a commonly used password</li>
                          <li>Cannot be entirely numeric</li>
                          <li>Must be different from your current password</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={passwordLoading}
                        placeholder="Confirm your new password"
                      />
                    </div>
                    
                    <Button
                      onClick={handleChangePassword}
                      disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                      className="w-full"
                    >
                      {passwordLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Changing Password...
                        </>
                      ) : (
                        "Change Password"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Buddy Customization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span className="text-xl">🤖</span>
                <span>Desktop Buddy</span>
              </CardTitle>
              <CardDescription>Customize your AI companion's appearance and behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buddyName">Buddy Name</Label>
                  <Input
                    id="buddyName"
                    value={preferences.buddyName}
                    onChange={(e) => updatePreference("buddyName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="buddyAppearance">Appearance</Label>
                  <Select
                    value={preferences.buddyAppearance}
                    onValueChange={(value) => updatePreference("buddyAppearance", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cat">🐱 Cat</SelectItem>
                      <SelectItem value="dog">🐶 Dog</SelectItem>
                      <SelectItem value="robot">🤖 Robot</SelectItem>
                      <SelectItem value="owl">🦉 Owl</SelectItem>
                      <SelectItem value="panda">🐼 Panda</SelectItem>
                      <SelectItem value="wolf">🐺 Wolf</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Calendar Integration */}
          <Card id="calendar-integration">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <span>Calendar Integration</span>
              </CardTitle>
              <CardDescription>Connect your external calendars to see events on your dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {calendarLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Loading calendars...</span>
                </div>
              ) : (
                <>
                  {/* Connected Calendars */}
                  {calendarConnections.length > 0 && (
                    <div className="space-y-3">
                      <Label>Connected Calendars</Label>
                      {calendarConnections.map((connection) => (
                        <div
                          key={connection.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">
                                {connection.provider === 'google' ? '📅' : connection.provider === 'outlook' ? '📆' : '🗓️'}
                              </span>
                              <div>
                                <p className="font-medium text-sm">{connection.calendar_name}</p>
                                <p className="text-xs text-gray-500">
                                  {connection.provider_display}
                                  {connection.last_synced_at && (
                                    <> • Last synced: {new Date(connection.last_synced_at).toLocaleString()}</>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {connection.needs_refresh && (
                              <span className="text-xs text-orange-600 dark:text-orange-400">Needs refresh</span>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSync(connection.id)}
                              disabled={syncLoading === connection.id}
                            >
                              {syncLoading === connection.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisconnect(connection.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Connect Buttons */}
                  <div className="space-y-2">
                    <Label>Connect Calendar</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Button
                        onClick={handleConnectGoogle}
                        variant="outline"
                        className="flex items-center justify-center space-x-2"
                        disabled={calendarLoading}
                      >
                        <span className="text-lg">📅</span>
                        <span>Google Calendar</span>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        disabled
                        className="flex items-center justify-center space-x-2 opacity-50"
                      >
                        <span className="text-lg">📆</span>
                        <span>Outlook</span>
                        <span className="text-xs">(Coming Soon)</span>
                      </Button>
                      <Button
                        variant="outline"
                        disabled
                        className="flex items-center justify-center space-x-2 opacity-50"
                      >
                        <span className="text-lg">🗓️</span>
                        <span>Apple Calendar</span>
                        <span className="text-xs">(Coming Soon)</span>
                      </Button>
                    </div>
                  </div>

                  {/* Sync All Button */}
                  {calendarConnections.length > 0 && (
                    <div className="pt-2 border-t">
                      <Button
                        onClick={() => handleSync()}
                        variant="outline"
                        className="w-full"
                        disabled={syncLoading === -1}
                      >
                        {syncLoading === -1 ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Syncing...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Sync All Calendars
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {calendarConnections.length === 0 && (
                    <div className="text-center py-6 text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No calendars connected yet</p>
                      <p className="text-xs mt-1">Connect a calendar to see your events on the dashboard</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Theme Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="h-5 w-5 text-purple-500" />
                <span>Appearance</span>
              </CardTitle>
              <CardDescription>Customize the theme of the app</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select value={preferences.theme || "light"} onValueChange={(value) => updatePreference("theme", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">☀️ Light Mode</SelectItem>
                    <SelectItem value="dark">🌙 Dark Mode</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-red-500" />
                <span>Data Management</span>
              </CardTitle>
              <CardDescription>Export, backup, or delete your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  onClick={exportData} 
                  variant="outline" 
                  className="flex-1"
                  disabled={exportingData}
                >
                  {exportingData ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export Data (PDF)
                    </>
                  )}
                </Button>
                <Button onClick={resetSettings} variant="outline" className="flex-1">
                  <Settings className="h-4 w-4 mr-2" />
                  Reset Settings
                </Button>
                <Button 
                  onClick={() => setShowClearDataDialog(true)} 
                  variant="destructive" 
                  className="flex-1"
                  disabled={clearingData}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {clearingData ? "Clearing..." : "Clear All Data"}
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                Export your data as a PDF file containing your username, tasks, mood logs, chat history, and analytics. 
                Reset settings to defaults, or permanently delete all stored information.
              </p>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Clear All Data Confirmation Dialog */}
      <AlertDialog open={showClearDataDialog} onOpenChange={setShowClearDataDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Data?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Are you sure you want to delete all your data? This will permanently remove:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>All tasks</li>
                  <li>All mood entries and history</li>
                  <li>All chat messages</li>
                  <li>All focus sessions and focus time</li>
                  <li>All calendar connections</li>
                  <li>All mindfulness sessions (local storage)</li>
                  <li>All app preferences and settings</li>
                </ul>
                <br />
                <span className="font-semibold text-red-600 dark:text-red-400">This action cannot be undone. Your account will be reset to a fresh state as if you just created it.</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingData}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearAllData}
              className="bg-red-600 hover:bg-red-700"
              disabled={clearingData}
            >
              {clearingData ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                "Clear All Data"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect Calendar Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this calendar? All synced events will be removed.
              <br />
              <span className="font-semibold text-red-600 dark:text-red-400">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConnectionToDisconnect(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDisconnect}
              className="bg-red-600 hover:bg-red-700"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Settings Confirmation Dialog */}
      <AlertDialog open={showResetSettingsDialog} onOpenChange={setShowResetSettingsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Settings to Default?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Are you sure you want to reset all settings to their default values? This will reset:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Theme (back to light mode)</li>
                  <li>Calendar Integration (all Google Calendar connections will be disconnected)</li>
                  <li>Buddy name (back to "Buddy")</li>
                  <li>Buddy appearance (back to default)</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmResetSettings}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Reset Settings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Navigation Confirmation Dialog */}
      <AlertDialog open={showNavigationDialog} onOpenChange={setShowNavigationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to your settings. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleNavigationCancel}>Stay on Page</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleNavigationDiscard}
              className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400"
            >
              Discard Changes
            </Button>
            <AlertDialogAction onClick={handleNavigationSave} className="bg-blue-600 hover:bg-blue-700">
              Save & Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
