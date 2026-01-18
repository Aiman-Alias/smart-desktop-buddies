// Mood check-in reminder service

export class MoodReminderService {
  private static reminderInterval: NodeJS.Timeout | null = null
  private static lastReminderDate: string | null = null

  static startDailyReminder(reminderTime: string = '09:00'): void {
    // Clear existing interval
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval)
    }

    // Check if reminder should be shown today
    const checkAndShowReminder = () => {
      const today = new Date().toDateString()
      
      // Don't show if already shown today
      if (this.lastReminderDate === today) {
        return
      }

      // Check if it's time for the reminder
      const now = new Date()
      const [hours, minutes] = reminderTime.split(':').map(Number)
      const reminderDate = new Date()
      reminderDate.setHours(hours, minutes, 0, 0)

      // Show reminder if current time is past reminder time
      if (now >= reminderDate) {
        this.showReminder()
        this.lastReminderDate = today
      }
    }

    // Check immediately
    checkAndShowReminder()

    // Check every minute
    this.reminderInterval = setInterval(checkAndShowReminder, 60000)
  }

  static stopReminder(): void {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval)
      this.reminderInterval = null
    }
  }

  static showReminder(): void {
    // Import dynamically to avoid circular dependencies
    import('./notifications').then(({ NotificationService }) => {
      NotificationService.showMoodCheckIn()
    })
  }

  static markReminderShown(): void {
    this.lastReminderDate = new Date().toDateString()
  }
}

