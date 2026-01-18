"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Heart, Brain, Timer, BarChart3, Sun, Moon } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { useTheme } from "next-themes"
import Link from "next/link"

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [localTheme, setLocalTheme] = useState<"light" | "dark">("light")
  const { login, register, user } = useAuth()
  const { setTheme: setNextTheme } = useTheme()

  // Initialize theme - default to light mode for auth page
  // Use local theme state for auth page only
  useEffect(() => {
    const savedTheme = localStorage.getItem("authPageTheme") as "light" | "dark" | null
    // Default to light mode (not system preference)
    const initialTheme = savedTheme || "light"
    setLocalTheme(initialTheme)
    // Use next-themes to set theme (but store in separate key)
    setNextTheme(initialTheme)
  }, [setNextTheme])

  // Check for email verification and password reset success messages in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const verified = urlParams.get('verified')
      const passwordReset = urlParams.get('passwordReset')
      if (verified === 'true') {
        setSuccessMessage("Your email has been verified successfully! You can now log in to your account.")
        // Clear the URL parameter
        window.history.replaceState({}, '', window.location.pathname)
      } else if (passwordReset === 'true') {
        setSuccessMessage("Your password has been reset successfully! You can now log in with your new password.")
        // Clear the URL parameter
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = localTheme === "light" ? "dark" : "light"
    setLocalTheme(newTheme)
    localStorage.setItem("authPageTheme", newTheme)
    setNextTheme(newTheme)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      if (isLogin) {
        await login(formData.email, formData.password)
      } else {
        if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match!")
          return
        }
        
        // Validate password requirements
        if (formData.password.length < 8) {
          setError("Password must be at least 8 characters long.")
          return
        }
        
        // Check if password is entirely numeric
        if (/^\d+$/.test(formData.password)) {
          setError("Password cannot be entirely numeric.")
          return
        }
        
        // Check if password is too similar to username or email
        const usernameLower = formData.username.toLowerCase()
        const emailLower = formData.email.toLowerCase()
        const passwordLower = formData.password.toLowerCase()
        
        if (usernameLower && passwordLower.includes(usernameLower) && usernameLower.length >= 3) {
          setError("Password cannot be too similar to your username.")
          return
        }
        
        if (emailLower && passwordLower.includes(emailLower.split('@')[0]) && emailLower.split('@')[0].length >= 3) {
          setError("Password cannot be too similar to your email.")
          return
        }
        
        const response = await register(formData.username, formData.email, formData.password)
        
        // Registration successful - show verification message
        if (response && response.message) {
          setSuccessMessage(response.message)
          setError("")
          // Clear form
          setFormData({
            username: "",
            email: "",
            password: "",
            confirmPassword: "",
          })
          // Switch to login view
          setIsLogin(true)
          return
        }
      }
      
      // After successful login, check for user-specific preferences
      // Default to light mode - dashboard/settings will load user-specific preferences
      setNextTheme("light")
      document.documentElement.classList.remove("dark")
      
      // Clear auth page theme from localStorage (it's separate from user preferences)
      localStorage.removeItem("authPageTheme")
      
      // Store current user ID to prevent loading old preferences
      // For login, user is set in auth context, so we need to wait a bit for it to be available
      // or get it from the login response. For now, dashboard will handle this on mount.
      
      // Small delay to ensure theme is applied before navigation
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 relative">
      {/* Theme Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-50 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        {localTheme === "light" ? (
          <Moon className="h-5 w-5" />
        ) : (
          <Sun className="h-5 w-5" />
        )}
      </Button>
      
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left side - App showcase */}
        <div className="space-y-8">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl lg:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Smart Desktop Buddies
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
              Your companion for better mental health and study productivity
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 border-2 border-blue-100 dark:border-blue-900/30 hover:border-blue-200 dark:hover:border-blue-800/50 transition-colors bg-white dark:bg-gray-800">
              <Heart className="h-8 w-8 text-red-500 mb-2" />
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Mental Health</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">Mood tracking & wellness</p>
            </Card>
            <Card className="p-4 border-2 border-green-100 dark:border-green-900/30 hover:border-green-200 dark:hover:border-green-800/50 transition-colors bg-white dark:bg-gray-800">
              <Timer className="h-8 w-8 text-green-500 mb-2" />
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Productivity</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">Equipped with productivity tools</p>
            </Card>
            <Card className="p-4 border-2 border-purple-100 dark:border-purple-900/30 hover:border-purple-200 dark:hover:border-purple-800/50 transition-colors bg-white dark:bg-gray-800">
              <Brain className="h-8 w-8 text-purple-500 mb-2" />
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">AI Companion</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">Guidance from AI chatbot</p>
            </Card>
            <Card className="p-4 border-2 border-orange-100 dark:border-orange-900/30 hover:border-orange-200 dark:hover:border-orange-800/50 transition-colors bg-white dark:bg-gray-800">
              <BarChart3 className="h-8 w-8 text-orange-500 mb-2" />
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Analytics</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">Behavior monitoring</p>
            </Card>
          </div>
        </div>

        {/* Right side - Auth form */}
        <Card className="w-full max-w-md mx-auto border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-gray-900 dark:text-gray-100">Welcome Back!</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              {isLogin ? "Sign in to continue your journey" : "Create your account to get started"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {successMessage && (
              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm rounded border border-green-200 dark:border-green-800/50">
                <div className="flex items-start space-x-2">
                  <span className="text-lg">✓</span>
                  <div>
                    <p className="font-semibold mb-1">Success!</p>
                    <p>{successMessage}</p>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded border border-red-200 dark:border-red-800/50">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-gray-900 dark:text-gray-100">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="Enter your username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-900 dark:text-gray-100">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-900 dark:text-gray-100">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                {!isLogin && (
                  <div className="text-xs text-gray-500 space-y-1 mt-2">
                    <p className="font-semibold text-gray-700 dark:text-gray-300">Password Requirements:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-gray-600 dark:text-gray-400">
                      <li>At least 8 characters long</li>
                      <li>Cannot be too similar to your username or email</li>
                      <li>Cannot be a commonly used password</li>
                      <li>Cannot be entirely numeric</li>
                    </ul>
                  </div>
                )}
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-gray-900 dark:text-gray-100">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="mt-6 space-y-2 text-center">
              {isLogin && (
                <div>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setSuccessMessage("")
                  setError("")
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
