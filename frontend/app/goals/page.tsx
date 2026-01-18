"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, Target, Calendar, Trash2, Edit, CheckCircle2, Circle, Loader2, TrendingUp } from "lucide-react"
import Link from "next/link"
import { api, Goal } from "@/lib/api"
import { useAuth } from "@/lib/auth"

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    target_date: "",
  })
  const { user } = useAuth()

  // Load goals from API
  useEffect(() => {
    if (!user) return

    const loadGoals = async () => {
      try {
        setLoading(true)
        setError(null)
        const goalsData = await api.getGoals()
        setGoals(goalsData)
      } catch (err) {
        console.error('Failed to load goals:', err)
        setError(err instanceof Error ? err.message : 'Failed to load goals')
      } finally {
        setLoading(false)
      }
    }

    loadGoals()
  }, [user])

  const resetForm = () => {
    setFormData({ title: "", description: "", target_date: "" })
    setShowAddForm(false)
    setEditingGoal(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      setSaving(true)
      setError(null)

      if (editingGoal) {
        const updated = await api.updateGoal(
          editingGoal,
          formData.title,
          formData.description,
          formData.target_date
        )
        setGoals(goals.map(g => g.id === editingGoal ? updated : g))
      } else {
        const newGoal = await api.createGoal(
          formData.title,
          formData.description,
          formData.target_date
        )
        setGoals([newGoal, ...goals])
      }

      resetForm()
    } catch (err) {
      console.error('Failed to save goal:', err)
      setError(err instanceof Error ? err.message : 'Failed to save goal')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!user || !confirm("Are you sure you want to delete this goal?")) return

    try {
      setError(null)
      await api.deleteGoal(id)
      setGoals(goals.filter(g => g.id !== id))
    } catch (err) {
      console.error('Failed to delete goal:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete goal')
    }
  }

  const handleStatusChange = async (id: number, newStatus: 'not_started' | 'in_progress' | 'completed') => {
    if (!user) return

    try {
      setError(null)
      const updated = await api.updateGoal(id, undefined, undefined, undefined, newStatus)
      setGoals(goals.map(g => g.id === id ? updated : g))
    } catch (err) {
      console.error('Failed to update goal status:', err)
      setError(err instanceof Error ? err.message : 'Failed to update goal status')
    }
  }

  const startEditing = (goal: Goal) => {
    setEditingGoal(goal.id)
    setFormData({
      title: goal.title,
      description: goal.description,
      target_date: goal.target_date,
    })
    setShowAddForm(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200"
      case "in_progress":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "not_started":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />
      case "in_progress":
        return <TrendingUp className="h-4 w-4" />
      default:
        return <Circle className="h-4 w-4" />
    }
  }

  const getDaysUntilTarget = (targetDate: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(targetDate)
    target.setHours(0, 0, 0, 0)
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const getProgressPercentage = () => {
    if (goals.length === 0) return 0
    const completed = goals.filter(g => g.status === 'completed').length
    return Math.round((completed / goals.length) * 100)
  }

  const stats = {
    total: goals.length,
    completed: goals.filter(g => g.status === 'completed').length,
    in_progress: goals.filter(g => g.status === 'in_progress').length,
    not_started: goals.filter(g => g.status === 'not_started').length,
    progress: getProgressPercentage(),
  }

  const filteredGoals = {
    all: goals,
    not_started: goals.filter(g => g.status === 'not_started'),
    in_progress: goals.filter(g => g.status === 'in_progress'),
    completed: goals.filter(g => g.status === 'completed'),
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Goals & Progress
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
                <p className="text-sm text-gray-600">Total Goals</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.in_progress}</div>
                <p className="text-sm text-gray-600">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{stats.progress}%</div>
                <p className="text-sm text-gray-600">Completion Rate</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Add/Edit Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  <span>{editingGoal ? "Edit Goal" : "New Goal"}</span>
                </CardTitle>
                <CardDescription>
                  {editingGoal ? "Update your goal details" : "Set a new goal and track your progress"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!showAddForm ? (
                  <Button onClick={() => setShowAddForm(true)} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Goal
                  </Button>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Goal Title</label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g., Learn React"
                        required
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Description</label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Describe your goal..."
                        rows={4}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Target Date</label>
                      <Input
                        type="date"
                        value={formData.target_date}
                        onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                        required
                        disabled={saving}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button type="submit" disabled={saving} className="flex-1">
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            {editingGoal ? "Update" : "Create"} Goal
                          </>
                        )}
                      </Button>
                      <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Progress Card */}
            {stats.total > 0 && (
              <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                <CardHeader>
                  <CardTitle className="text-purple-800">📊 Overall Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Completion Rate</span>
                        <span className="font-bold">{stats.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-purple-600 h-3 rounded-full transition-all"
                          style={{ width: `${stats.progress}% }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>✅ Completed</span>
                        <span className="font-bold">{stats.completed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>🔄 In Progress</span>
                        <span className="font-bold">{stats.in_progress}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>⏳ Not Started</span>
                        <span className="font-bold">{stats.not_started}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Goals List */}
          <div className="lg:col-span-2 space-y-6">
            {loading ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 mx-auto mb-4 text-gray-300 animate-spin" />
                    <p className="text-gray-500">Loading goals...</p>
                  </div>
                </CardContent>
              </Card>
            ) : goals.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 mb-4">No goals yet. Create your first goal to get started!</p>
                    <Button onClick={() => setShowAddForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Goal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {goals.map((goal) => {
                  const daysUntil = getDaysUntilTarget(goal.target_date)
                  const isOverdue = daysUntil < 0 && goal.status !== 'completed'
                  
                  return (
                    <Card key={goal.id} className={isOverdue ? "border-red-300 bg-red-50" : ""}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="flex items-center space-x-2 mb-2">
                              {getStatusIcon(goal.status)}
                              <span>{goal.title}</span>
                            </CardTitle>
                            <CardDescription className="mt-2">{goal.description}</CardDescription>
                          </div>
                          <Badge className={getStatusColor(goal.status)}>
                            {goal.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            <span>Target: {new Date(goal.target_date).toLocaleDateString()}</span>
                            {isOverdue ? (
                              <Badge variant="destructive" className="ml-2">
                                Overdue by {Math.abs(daysUntil)} days
                              </Badge>
                            ) : daysUntil >= 0 ? (
                              <Badge variant="outline" className="ml-2">
                                {daysUntil === 0 ? "Due today" : `${daysUntil} days left`}
                              </Badge>
                            ) : null}
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">Status:</span>
                            <div className="flex space-x-1">
                              <Button
                                size="sm"
                                variant={goal.status === 'not_started' ? 'default' : 'outline'}
                                onClick={() => handleStatusChange(goal.id, 'not_started')}
                                className="h-7 text-xs"
                              >
                                Not Started
                              </Button>
                              <Button
                                size="sm"
                                variant={goal.status === 'in_progress' ? 'default' : 'outline'}
                                onClick={() => handleStatusChange(goal.id, 'in_progress')}
                                className="h-7 text-xs"
                              >
                                In Progress
                              </Button>
                              <Button
                                size="sm"
                                variant={goal.status === 'completed' ? 'default' : 'outline'}
                                onClick={() => handleStatusChange(goal.id, 'completed')}
                                className="h-7 text-xs"
                              >
                                Completed
                              </Button>
                            </div>
                          </div>

                          <div className="flex space-x-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(goal)}
                              className="flex-1"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(goal.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

