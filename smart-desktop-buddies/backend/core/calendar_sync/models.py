from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

class CalendarConnection(models.Model):
    """
    Stores OAuth tokens and connection information for external calendars
    """
    PROVIDER_CHOICES = [
        ('google', 'Google Calendar'),
        ('outlook', 'Microsoft Outlook'),
        ('apple', 'Apple iCloud'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='calendar_connections')
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    
    # OAuth tokens (will be encrypted in services)
    access_token = models.TextField()  # Encrypted
    refresh_token = models.TextField(null=True, blank=True)  # Encrypted
    token_expires_at = models.DateTimeField(null=True, blank=True)
    
    # Calendar information
    calendar_id = models.CharField(max_length=255)  # External calendar ID
    calendar_name = models.CharField(max_length=255)
    account_email = models.CharField(max_length=255, null=True, blank=True)  # Email address of the connected account
    
    # Sync settings
    is_active = models.BooleanField(default=True)
    sync_enabled = models.BooleanField(default=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        unique_together = ['user', 'provider', 'calendar_id']
    
    def __str__(self):
        return f"{self.user.username} - {self.get_provider_display()} - {self.calendar_name}"
    
    def is_token_expired(self):
        """Check if access token is expired or will expire soon (within 5 minutes)"""
        if not self.token_expires_at:
            return True
        return timezone.now() >= (self.token_expires_at - timedelta(minutes=5))
    
    def needs_refresh(self):
        """Check if token needs to be refreshed.
        Returns False if calendar was recently synced (within last hour) to avoid showing
        'needs refresh' immediately after a successful sync."""
        # If recently synced (within last hour), don't show needs refresh
        if self.last_synced_at:
            time_since_sync = timezone.now() - self.last_synced_at
            if time_since_sync < timedelta(hours=1):
                return False
        
        # Otherwise check if token is expired
        return self.is_token_expired() and self.refresh_token is not None


class CalendarEvent(models.Model):
    """
    Stores calendar events synced from external calendars
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='calendar_events')
    calendar_connection = models.ForeignKey(CalendarConnection, on_delete=models.CASCADE, related_name='events')
    
    # External calendar event ID
    external_event_id = models.CharField(max_length=255, db_index=True)
    
    # Event details
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, null=True)
    location = models.CharField(max_length=500, blank=True, null=True)
    
    # Time information
    start_time = models.DateTimeField(db_index=True)
    end_time = models.DateTimeField()
    all_day = models.BooleanField(default=False)
    timezone = models.CharField(max_length=100, default='UTC')
    
    # Recurrence (stored as iCal RRULE string)
    recurrence_rule = models.CharField(max_length=500, blank=True, null=True)
    
    # Sync metadata
    last_modified = models.DateTimeField()  # Last modified time from external calendar
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['start_time']
        unique_together = ['calendar_connection', 'external_event_id']
        indexes = [
            models.Index(fields=['user', 'start_time']),
            models.Index(fields=['external_event_id']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.start_time.strftime('%Y-%m-%d %H:%M')}"
    
    def is_upcoming(self):
        """Check if event is in the future"""
        return self.start_time > timezone.now()
    
    def is_today(self):
        """Check if event is today"""
        today = timezone.now().date()
        return self.start_time.date() == today

