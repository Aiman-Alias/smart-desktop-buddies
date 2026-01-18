"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Play, Pause, RotateCcw, Trash2 } from "lucide-react"
import { NavigationBar } from "@/components/navigation-bar"
import { useAuth } from "@/lib/auth"
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

interface MindfulnessSession {
  id: string
  type: "breathing" | "meditation" | "quote"
  duration: number
  completedAt: string
}

export default function Mindfulness() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<MindfulnessSession[]>([])
  const [currentSession, setCurrentSession] = useState<"breathing" | "meditation" | null>(null)
  const [sessionTime, setSessionTime] = useState(0)
  const [totalTime, setTotalTime] = useState(300) // 5 minutes default
  const [isRunning, setIsRunning] = useState(false)
  const [breathingPhase, setBreathingPhase] = useState<"inhale" | "hold" | "exhale">("inhale")
  const [breathingCount, setBreathingCount] = useState(0)
  const [currentQuote, setCurrentQuote] = useState(0)
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false)

  // Get user-specific localStorage key
  const getStorageKey = () => {
    if (!user) return null
    return `smartBuddyMindfulnessSessions_${user.id}`
  }

  const quotes = [
    "The present moment is the only time over which we have dominion. - Thích Nhất Hạnh",
    "Wherever you are, be there totally. - Eckhart Tolle",
    "Peace comes from within. Do not seek it without. - Buddha",
    "The mind is everything. What you think you become. - Buddha",
    "In the midst of winter, I found there was, within me, an invincible summer. - Albert Camus",
    "You have power over your mind - not outside events. Realize this, and you will find strength. - Marcus Aurelius",
    "The best way to take care of the future is to take care of the present moment. - Thích Nhất Hạnh",
    "Mindfulness is a way of befriending ourselves and our experience. - Jon Kabat-Zinn",
  ]

  useEffect(() => {
    // Load user-specific sessions
    const storageKey = getStorageKey()
    if (storageKey) {
      const savedSessions = localStorage.getItem(storageKey)
      if (savedSessions) {
        try {
          setSessions(JSON.parse(savedSessions))
        } catch (error) {
          console.error('Error parsing saved sessions:', error)
          setSessions([])
        }
      } else {
        setSessions([])
      }
    } else {
      setSessions([])
    }

    // Rotate quotes every 10 seconds
    const quoteInterval = setInterval(() => {
      setCurrentQuote((prev) => (prev + 1) % quotes.length)
    }, 10000)

    return () => clearInterval(quoteInterval)
  }, [quotes.length, user])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isRunning && sessionTime < totalTime) {
      interval = setInterval(() => {
        setSessionTime((time) => time + 1)
      }, 1000)
    } else if (sessionTime >= totalTime && isRunning) {
      completeSession()
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, sessionTime, totalTime])

  useEffect(() => {
    // Breathing exercise timing
    if (currentSession === "breathing" && isRunning) {
      const breathingInterval = setInterval(() => {
        setBreathingCount((prev) => {
          const newCount = prev + 1
          const cycle = newCount % 16 // 4 seconds inhale, 4 hold, 8 exhale

          if (cycle < 4) {
            setBreathingPhase("inhale")
          } else if (cycle < 8) {
            setBreathingPhase("hold")
          } else {
            setBreathingPhase("exhale")
          }

          return newCount
        })
      }, 1000)

      return () => clearInterval(breathingInterval)
    }
  }, [currentSession, isRunning])

  const startSession = (type: "breathing" | "meditation", duration: number) => {
    setCurrentSession(type)
    setTotalTime(duration)
    setSessionTime(0)
    setIsRunning(true)
    setBreathingCount(0)
    setBreathingPhase("inhale")
  }

  const pauseSession = () => {
    setIsRunning(!isRunning)
  }

  const resetSession = () => {
    // If timer is stopped and already reset, go back to practice selection
    if (!isRunning && sessionTime === 0) {
      setCurrentSession(null)
      setIsRunning(false)
      setSessionTime(0)
      setBreathingCount(0)
      setBreathingPhase("inhale")
      return
    }
    
    // Otherwise, reset the timer and stop it
    setIsRunning(false)
    setSessionTime(0)
    setBreathingCount(0)
    setBreathingPhase("inhale")
  }

  const completeSession = () => {
    if (!currentSession || !user) return

    const session: MindfulnessSession = {
      id: Date.now().toString(),
      type: currentSession,
      duration: totalTime,
      completedAt: new Date().toISOString(),
    }

    const updatedSessions = [...sessions, session]
    setSessions(updatedSessions)
    
    // Save to user-specific localStorage
    const storageKey = getStorageKey()
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(updatedSessions))
    }

    setIsRunning(false)
    setCurrentSession(null)
    setSessionTime(0)
  }

  const clearAllSessions = () => {
    if (!user) return
    
    setSessions([])
    const storageKey = getStorageKey()
    if (storageKey) {
      localStorage.removeItem(storageKey)
    }
    setShowClearHistoryDialog(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getBreathingInstruction = () => {
    switch (breathingPhase) {
      case "inhale":
        return "Breathe In..."
      case "hold":
        return "Hold..."
      case "exhale":
        return "Breathe Out..."
    }
  }

  const getBreathingCircleSize = () => {
    switch (breathingPhase) {
      case "inhale":
        return "w-32 h-32"
      case "hold":
        return "w-32 h-32"
      case "exhale":
        return "w-20 h-20"
    }
  }

  const totalSessionsToday = sessions.filter(
    (session) => new Date(session.completedAt).toDateString() === new Date().toDateString(),
  ).length

  const totalMinutesToday =
    sessions
      .filter((session) => new Date(session.completedAt).toDateString() === new Date().toDateString())
      .reduce((sum, session) => sum + session.duration, 0) / 60

  const streak = sessions.length > 0 ? Math.min(sessions.length, 30) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <NavigationBar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Active Session */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Session */}
            {currentSession ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <span className="text-2xl">{currentSession === "breathing" ? "🫁" : "🧘"}</span>
                    <span>{currentSession === "breathing" ? "Breathing Exercise" : "Meditation Session"}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-6">
                    {currentSession === "breathing" && (
                      <div className="flex flex-col items-center space-y-6">
                        <div
                          className={`rounded-full bg-gradient-to-r from-blue-400 to-purple-400 transition-all duration-1000 ${getBreathingCircleSize()}`}
                        ></div>
                        <div className="text-2xl font-semibold text-blue-600">{getBreathingInstruction()}</div>
                      </div>
                    )}

                    {currentSession === "meditation" && (
                      <div className="flex flex-col items-center space-y-6">
                        <div className="text-6xl">🧘‍♀️</div>
                        <div className="text-xl text-gray-600">Find your center. Focus on your breath.</div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="text-4xl font-mono font-bold text-blue-600">
                        {formatTime(totalTime - sessionTime)}
                      </div>
                      <Progress value={(sessionTime / totalTime) * 100} className="w-full h-3" />
                    </div>

                    <div className="flex justify-center space-x-4">
                      <Button onClick={pauseSession} size="lg" className="bg-blue-600 hover:bg-blue-700">
                        {isRunning ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                        {isRunning ? "Pause" : "Resume"}
                      </Button>
                      <Button onClick={resetSession} variant="outline" size="lg">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                      <Button onClick={completeSession} variant="outline" size="lg">
                        Complete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Choose Your Practice</CardTitle>
                  <CardDescription>Select a mindfulness exercise to begin your session</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Breathing Exercises */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center space-x-2">
                        <span className="text-2xl">🫁</span>
                        <span>Breathing Exercises</span>
                      </h3>
                      <div className="space-y-2">
                        <Button
                          onClick={() => startSession("breathing", 180)}
                          variant="outline"
                          className="w-full justify-start h-12"
                        >
                          <div className="text-left">
                            <div className="font-medium">Quick Breathing (3 min)</div>
                            <div className="text-xs text-gray-500">4-4-8 breathing pattern</div>
                          </div>
                        </Button>
                        <Button
                          onClick={() => startSession("breathing", 300)}
                          variant="outline"
                          className="w-full justify-start h-12"
                        >
                          <div className="text-left">
                            <div className="font-medium">Standard Breathing (5 min)</div>
                            <div className="text-xs text-gray-500">Calm your nervous system</div>
                          </div>
                        </Button>
                        <Button
                          onClick={() => startSession("breathing", 600)}
                          variant="outline"
                          className="w-full justify-start h-12"
                        >
                          <div className="text-left">
                            <div className="font-medium">Deep Breathing (10 min)</div>
                            <div className="text-xs text-gray-500">Extended relaxation</div>
                          </div>
                        </Button>
                      </div>
                    </div>

                    {/* Meditation Sessions */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center space-x-2">
                        <span className="text-2xl">🧘</span>
                        <span>Meditation</span>
                      </h3>
                      <div className="space-y-2">
                        <Button
                          onClick={() => startSession("meditation", 300)}
                          variant="outline"
                          className="w-full justify-start h-12"
                        >
                          <div className="text-left">
                            <div className="font-medium">Beginner Meditation (5 min)</div>
                            <div className="text-xs text-gray-500">Perfect for starting out</div>
                          </div>
                        </Button>
                        <Button
                          onClick={() => startSession("meditation", 600)}
                          variant="outline"
                          className="w-full justify-start h-12"
                        >
                          <div className="text-left">
                            <div className="font-medium">Focus Meditation (10 min)</div>
                            <div className="text-xs text-gray-500">Improve concentration</div>
                          </div>
                        </Button>
                        <Button
                          onClick={() => startSession("meditation", 900)}
                          variant="outline"
                          className="w-full justify-start h-12"
                        >
                          <div className="text-left">
                            <div className="font-medium">Deep Meditation (15 min)</div>
                            <div className="text-xs text-gray-500">Advanced practice</div>
                          </div>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Sessions */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Sessions</CardTitle>
                  {sessions.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowClearHistoryDialog(true)}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 dark:bg-gray-800 dark:border-gray-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear History
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sessions
                    .slice(-5)
                    .reverse()
                    .map((session, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border dark:border-gray-700">
                        <div className="flex items-center space-x-3">
                          <span className="text-xl">{session.type === "breathing" ? "🫁" : "🧘"}</span>
                          <div>
                            <p className="text-sm font-medium dark:text-gray-200">
                              {session.type === "breathing" ? "Breathing" : "Meditation"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{Math.round(session.duration / 60)} minutes</p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(session.completedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  {sessions.length === 0 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">No sessions yet. Start your first practice!</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Benefits */}
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200 dark:from-green-900/20 dark:to-blue-900/20 dark:border-green-800/30">
              <CardHeader>
                <CardTitle className="text-green-800 dark:text-green-300">🌱 Benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-green-700 dark:text-green-300">
                  <p>• Reduces stress and anxiety</p>
                  <p>• Improves focus and concentration</p>
                  <p>• Better emotional regulation</p>
                  <p>• Enhanced sleep quality</p>
                  <p>• Increased self-awareness</p>
                  <p>• Boosts overall well-being</p>
                </div>
              </CardContent>
            </Card>

            {/* Daily Quote */}
            <Card className="bg-gradient-to-r from-purple-100 to-pink-100 border-purple-200 dark:from-purple-900/20 dark:to-pink-900/20 dark:border-purple-800/30">
              <CardContent className="p-6 text-center">
                <div className="text-2xl mb-4">🌸</div>
                <blockquote className="text-lg italic text-purple-800 dark:text-purple-300 mb-4">"{quotes[currentQuote]}"</blockquote>
                <p className="text-sm text-purple-600 dark:text-purple-400">Daily Mindfulness Quote</p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Stats & History */}
          <div className="space-y-6">
            {/* Today's Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Practice</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{totalSessionsToday}</div>
                  <p className="text-sm text-gray-600">Sessions Completed</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{Math.round(totalMinutesToday)}</div>
                  <p className="text-sm text-gray-600">Minutes Practiced</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">{streak}</div>
                  <p className="text-sm text-gray-600">Day Streak</p>
                </div>
              </CardContent>
            </Card>

            {/* Powerful Breathing Technique */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 dark:from-blue-900/20 dark:to-purple-900/20 dark:border-blue-800/30">
              <CardHeader>
                <CardTitle className="text-blue-800 dark:text-blue-300">🌬️ Powerful Breathing Technique</CardTitle>
                <CardDescription className="text-blue-700 dark:text-blue-400">
                  Learn and practice a powerful breathing technique to enhance your mindfulness practice
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full rounded-lg overflow-hidden shadow-lg bg-black">
                  <div className="relative pb-[56.25%] h-0">
                    <iframe
                      className="absolute top-0 left-0 w-full h-full"
                      src="https://www.youtube.com/embed/tybOi4hjZFQ"
                      title="Powerful Breathing Technique"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <a
                    href="https://www.youtube.com/watch?v=tybOi4hjZFQ"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                  >
                    Watch on YouTube
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 dark:from-yellow-900/20 dark:to-orange-900/20 dark:border-yellow-800/30">
              <CardHeader>
                <CardTitle className="text-orange-800 dark:text-orange-300">💡 Quick Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-orange-700 dark:text-orange-300">
                  <p>• Find a quiet, comfortable space</p>
                  <p>• Start with shorter sessions</p>
                  <p>• Be consistent with daily practice</p>
                  <p>• Don't judge your thoughts</p>
                  <p>• Focus on your breath as an anchor</p>
                  <p>• Practice self-compassion</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Clear History Confirmation Dialog */}
      <AlertDialog open={showClearHistoryDialog} onOpenChange={setShowClearHistoryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Session History?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all session history? This will remove {sessions.length} session{sessions.length !== 1 ? 's' : ''} from your history. This action cannot be undone.
              <br /><br />
              <span className="text-sm text-gray-500">Note: This will clear your session history, but you can start fresh with new sessions.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearAllSessions}
              className="bg-red-600 hover:bg-red-700"
            >
              Clear History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
