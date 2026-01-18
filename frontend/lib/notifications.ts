// Notification utility for browser notifications

export class NotificationService {
  private static permission: NotificationPermission = 'default'

  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications')
      return false
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted'
      return true
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      this.permission = permission
      return permission === 'granted'
    }

    return false
  }

  static async show(title: string, options?: NotificationOptions): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported')
      return
    }

    if (this.permission !== 'granted') {
      const granted = await this.requestPermission()
      if (!granted) {
        console.warn('Notification permission denied')
        return
      }
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      })

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close()
      }, 5000)

      // Handle click
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    } catch (error) {
      console.error('Error showing notification:', error)
    }
  }

  static showBreakReminder() {
    this.show('⏰ Time for a Break!', {
      body: 'You\'ve been working hard. Take a 5-minute break to recharge!',
      tag: 'break-reminder',
      requireInteraction: false,
    })
  }

  static showWorkResume() {
    this.show('💪 Back to Work!', {
      body: 'Break time is over. Ready to get back to your tasks?',
      tag: 'work-resume',
      requireInteraction: false,
    })
  }

  static showMoodCheckIn() {
    this.show('💭 How are you feeling?', {
      body: 'Take a moment to check in with your mood today.',
      tag: 'mood-checkin',
      requireInteraction: false,
    })
  }
}

