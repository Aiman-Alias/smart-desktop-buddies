"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Bot, User, MessageCircle, Trash2, Info } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth"
import { api, ChatMessage } from "@/lib/api"
import { NavigationBar } from "@/components/navigation-bar"
import { useToast } from "@/hooks/use-toast"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Message {
  id: string
  content: string
  isBot: boolean
  timestamp: Date
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [buddyName, setBuddyName] = useState("AI Chatbot")
  const [buddyAppearance, setBuddyAppearance] = useState("owl")
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()

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
      localStorage.setItem(lastUserIdKey, String(user.id))
      return
    }
    
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
      } catch (error) {
        console.error('Error loading buddy preferences:', error)
      }
    } else {
      // No preferences found - use defaults
      setBuddyName("Buddy")
      setBuddyAppearance("owl")
    }

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
        } catch (error) {
          console.error('Error loading buddy preferences:', error)
        }
      }
    }, 1000)

    loadChatMessages()

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(preferenceCheckInterval)
    }
  }, [user, router, buddyName, buddyAppearance])

  useEffect(() => {
    // Scroll to bottom when new messages are added
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    // Use setTimeout to ensure DOM is updated
    setTimeout(() => {
      if (scrollAreaRef.current) {
        // Find the ScrollArea viewport element
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight
        }
      }
      // Also try scrollIntoView as fallback
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 150)
  }

  const loadChatMessages = async () => {
    try {
      const chatMessages = await api.getChatMessages()
      const formattedMessages: Message[] = chatMessages.map((msg: ChatMessage) => ({
        id: msg.id.toString(),
        content: msg.content,
        isBot: msg.role === 'assistant',
        timestamp: new Date(msg.created_at)
      })).reverse() // Reverse to show oldest first

      // If no messages exist, show welcome message for first-time users
      if (formattedMessages.length === 0) {
        setMessages([getWelcomeMessage()])
      } else {
        setMessages(formattedMessages)
      }
    } catch (error) {
      console.error('Failed to load chat messages:', error)
      // Start with a welcome message if API fails
      setMessages([getWelcomeMessage()])
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      isBot: false,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    // Scroll to show user's message
    scrollToBottom()

    try {
      const response = await api.sendChatMessage(userMessage.content)
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.message,
        isBot: true,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, botMessage])
      // Scroll to show bot's response
      scrollToBottom()
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I'm having trouble connecting right now. Please try again later.",
        isBot: true,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Get the welcome message content
  const getWelcomeMessage = (): Message => {
    return {
      id: 'welcome-1',
      content: `Hello${user ? `, ${user.username}` : ''}! 👋 Welcome to your AI companion! I'm here to help you on your journey to better productivity and well-being.

**What I can help you with:**

📊 **Productivity Tips** - Get advice on managing tasks, staying focused, and improving your workflow

😊 **Mood Support** - Talk about your feelings, get encouragement, or discuss mental wellness

🎯 **Goal Setting** - Help you set and achieve your personal and academic goals

🧘 **Mindfulness Guidance** - Provide meditation tips, breathing exercises, and stress management advice

📚 **Study Help** - Assist with study strategies, time management, and academic planning

💬 **General Chat** - Just want to talk? I'm here to listen and chat about anything!

**How to get started:**
Simply type your question or message below, and I'll respond right away. You can ask me anything - from productivity advice to emotional support, I'm here to help!

What would you like to talk about today? 😊`,
      isBot: true,
      timestamp: new Date()
    }
  }

  const handleClearAllChats = async () => {
    if (!user) return
    
    setIsClearing(true)
    try {
      // Get all chat messages
      const chatMessages = await api.getChatMessages()
      
      // Delete all messages
      await Promise.all(chatMessages.map((msg: ChatMessage) => api.deleteChatMessage(msg.id)))
      
      // Clear messages and show welcome message
      const welcomeMessage = getWelcomeMessage()
      setMessages([welcomeMessage])
      
      toast({
        title: "Chat Cleared",
        description: "All chat messages have been deleted. Starting fresh!",
      })
      
      setShowClearDialog(false)
    } catch (error) {
      console.error('Failed to clear chat messages:', error)
      toast({
        title: "Clear Failed",
        description: error instanceof Error ? error.message : 'Failed to clear chat messages. Please try again.',
        variant: "destructive",
      })
    } finally {
      setIsClearing(false)
    }
  }

  // Function to format message content with markdown-style formatting
  const formatMessageContent = (content: string) => {
    // Split content by lines to handle line breaks and lists
    const lines = content.split('\n')
    
    return lines.map((line, lineIndex) => {
      const trimmedLine = line.trim()
      
      // Skip empty lines but preserve spacing
      if (trimmedLine === '') {
        return <div key={lineIndex} className="mb-2"></div>
      }
      
      // Check for headings (###, ##, #)
      const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/)
      if (headingMatch) {
        const [, hashes, headingText] = headingMatch
        const level = hashes.length
        const headingSize = level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-lg'
        const headingMargin = level === 1 ? 'mt-6 mb-4' : level === 2 ? 'mt-5 mb-3' : 'mt-4 mb-2'
        
        // Process heading text for bold
        const headingParts = headingText.split(/(\*\*.*?\*\*)/g)
        
        return (
          <div key={lineIndex} className={`${headingSize} font-bold ${headingMargin} text-gray-900 dark:text-gray-100`}>
            {headingParts.map((part, partIndex) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                const boldText = part.slice(2, -2)
                return <strong key={partIndex} className="text-blue-600 dark:text-blue-400">{boldText}</strong>
              }
              return <span key={partIndex}>{part}</span>
            })}
          </div>
        )
      }
      
      // Check if this is a bullet point (* or -)
      const bulletMatch = trimmedLine.match(/^[\*\-\+]\s+(.+)$/)
      if (bulletMatch) {
        const [, listContent] = bulletMatch
        // Process the list content for bold text
        const contentParts = listContent.split(/(\*\*.*?\*\*)/g)
        
        return (
          <div key={lineIndex} className="mb-2 flex items-start">
            <span className="text-gray-600 dark:text-gray-400 mr-3 mt-1">•</span>
            <span className="flex-1 text-gray-800 dark:text-gray-200">
              {contentParts.map((part, partIndex) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  const boldText = part.slice(2, -2)
                  return <strong key={partIndex} className="font-semibold text-blue-600 dark:text-blue-400">{boldText}</strong>
                }
                return <span key={partIndex}>{part}</span>
              })}
            </span>
          </div>
        )
      }
      
      // Check if this is a numbered list item (e.g., "1. **text**")
      const listMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/)
      if (listMatch) {
        const [, number, listContent] = listMatch
        // Process the list content for bold text
        const contentParts = listContent.split(/(\*\*.*?\*\*)/g)
        
        return (
          <div key={lineIndex} className="mb-2 flex items-start">
            <span className="font-semibold text-gray-700 dark:text-gray-300 mr-3 min-w-[24px]">{number}.</span>
            <span className="flex-1 text-gray-800 dark:text-gray-200">
              {contentParts.map((part, partIndex) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  const boldText = part.slice(2, -2)
                  return <strong key={partIndex} className="font-semibold text-blue-600 dark:text-blue-400">{boldText}</strong>
                }
                return <span key={partIndex}>{part}</span>
              })}
            </span>
          </div>
        )
      }
      
      // Regular line - process for bold text
      const parts = trimmedLine.split(/(\*\*.*?\*\*)/g)
      return (
        <div key={lineIndex} className="mb-2 text-gray-800 dark:text-gray-200">
          {parts.map((part, partIndex) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              const boldText = part.slice(2, -2)
              return <strong key={partIndex} className="font-semibold text-blue-600 dark:text-blue-400">{boldText}</strong>
            }
            return <span key={partIndex}>{part}</span>
          })}
        </div>
      )
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <NavigationBar />
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <MessageCircle className="h-6 w-6 text-blue-500 dark:text-blue-400" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">AI Chatbot</h1>
          </div>
          <div className="flex items-center space-x-2">
            {user && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Welcome, {user.username}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="max-w-4xl mx-auto px-4 pb-4">
        <Card className="flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
          <CardHeader className="flex-shrink-0">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{getBuddyEmoji(buddyAppearance)}</span>
                <span>{buddyName}</span>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <Info className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="bottom" 
                      className="max-w-sm p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
                    >
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">
                            What I can help you with:
                          </h4>
                          <ul className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
                            <li>• Productivity tips and task management</li>
                            <li>• Mood support and mental wellness</li>
                            <li>• Goal setting and achievement</li>
                            <li>• Mindfulness and meditation guidance</li>
                            <li>• Study strategies and time management</li>
                            <li>• General conversation and support</li>
                          </ul>
                        </div>
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                          <h4 className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">
                            Example prompts to get started:
                          </h4>
                          <ul className="text-xs space-y-1 text-gray-700 dark:text-gray-300 italic">
                            <li>"How can I improve my focus?"</li>
                            <li>"Help me set a study schedule"</li>
                            <li>"I'm feeling stressed, any tips?"</li>
                            <li>"What breathing exercises do you recommend?"</li>
                          </ul>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 ml-2">
                  <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
                  <span>Online</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearDialog(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <span className="text-4xl mx-auto mb-2 animate-pulse block">{getBuddyEmoji(buddyAppearance)}</span>
                    <p className="text-gray-500 dark:text-gray-400">Loading conversation...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pb-6">
                  {messages.map((message) => {
                    const isWelcomeMessage = message.id.startsWith('welcome')
                    return (
                      <div
                        key={message.id}
                        className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg p-4 ${
                            message.isBot
                              ? isWelcomeMessage
                                ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800/30 text-gray-800 dark:text-gray-200'
                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-800 dark:text-gray-200'
                              : 'bg-blue-500 dark:bg-blue-700 text-white'
                          }`}
                        >
                          <div className="flex items-center space-x-2 mb-3">
                            {message.isBot ? (
                              <span className="text-lg">{getBuddyEmoji(buddyAppearance)}</span>
                            ) : (
                              <User className="h-4 w-4 dark:text-gray-300" />
                            )}
                            <span className="text-xs opacity-70 dark:opacity-60">
                              {message.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <div className={`text-sm leading-relaxed ${isWelcomeMessage ? 'space-y-2' : 'space-y-3'}`}>
                            {message.isBot ? (
                              <div className="whitespace-pre-line">
                                {formatMessageContent(message.content)}
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg p-3 max-w-[70%]">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getBuddyEmoji(buddyAppearance)}</span>
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Invisible element to scroll to */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
            <div className="flex space-x-2 mt-4 pt-4 border-t dark:border-gray-700 flex-shrink-0">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1"
                disabled={isLoading || isLoadingMessages}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading || isLoadingMessages}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clear All Chats Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Chat Messages?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all chat messages? This action cannot be undone. 
              After clearing, you'll see the welcome message again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllChats}
              disabled={isClearing}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            >
              {isClearing ? "Clearing..." : "Clear All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}