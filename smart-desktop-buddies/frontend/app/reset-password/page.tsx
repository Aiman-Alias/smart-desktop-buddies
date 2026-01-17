"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import Link from "next/link"

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  })
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const tokenParam = searchParams.get("token")
    const emailParam = searchParams.get("email")

    if (!tokenParam || !emailParam) {
      setError("Invalid or missing reset link. Please request a new password reset.")
    } else {
      setToken(tokenParam)
      setEmail(emailParam)
    }
  }, [searchParams])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccessMessage("")

    if (!token || !email) {
      setError("Invalid reset link")
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match!")
      return
    }

    // Validate password requirements
    if (formData.newPassword.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }

    // Check if password is entirely numeric
    if (/^\d+$/.test(formData.newPassword)) {
      setError("Password cannot be entirely numeric.")
      return
    }

    setLoading(true)

    try {
      const result = await api.resetPassword(token, email, formData.newPassword, formData.confirmPassword)
      setSuccessMessage(result.message || "Password has been reset successfully!")
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/?passwordReset=true")
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4">
                  <XCircle className="h-12 w-12 text-red-500" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Invalid Reset Link
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {error || "The password reset link is invalid or has expired. Please request a new one."}
                </p>
              </div>
              <Link
                href="/forgot-password"
                className="inline-block text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
              >
                Request New Reset Link
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-3">
              <Lock className="h-6 w-6 text-blue-500" />
            </div>
          </div>
          <CardTitle className="text-2xl text-gray-900 dark:text-gray-100">Reset Your Password</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {successMessage && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm rounded border border-green-200 dark:border-green-800/50">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Success!</p>
                  <p>{successMessage}</p>
                  <p className="text-xs mt-2">Redirecting to login page...</p>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded border border-red-200 dark:border-red-800/50">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-gray-900 dark:text-gray-100">New Password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="Enter your new password"
                value={formData.newPassword}
                onChange={handleInputChange}
                required
                disabled={loading || !!successMessage}
                className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-gray-900 dark:text-gray-100">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your new password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                disabled={loading || !!successMessage}
                className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700 dark:text-gray-300">Password Requirements:</p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-600 dark:text-gray-400">
                <li>At least 8 characters long</li>
                <li>Cannot be too similar to your username or email</li>
                <li>Cannot be a commonly used password</li>
                <li>Cannot be entirely numeric</li>
              </ul>
            </div>

            <Button
              type="submit"
              disabled={loading || !!successMessage}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : successMessage ? (
                "Password Reset!"
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
            >
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
