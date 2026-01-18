from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

class ScreenActivity(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    application_name = models.CharField(max_length=200)
    window_title = models.CharField(max_length=500)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-start_time']
        verbose_name_plural = 'Screen Activities'
    
    def __str__(self):
        return f"{self.user.email} - {self.application_name} ({self.start_time})"

class BreakReminder(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    reminder_time = models.DateTimeField()
    is_dismissed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-reminder_time']
    
    def __str__(self):
        return f"{self.user.email} - Break Reminder ({self.reminder_time})"

class Activity(models.Model):
    ACTIVITY_TYPES = [
        ('work', 'Work'),
        ('study', 'Study'),
        ('exercise', 'Exercise'),
        ('social', 'Social'),
        ('entertainment', 'Entertainment'),
        ('other', 'Other'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    description = models.TextField()
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_time']
        verbose_name_plural = 'Activities'

    def __str__(self):
        return f"{self.user.username}'s {self.activity_type} activity"

class FocusSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='focus_sessions')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(default=0)  # Duration in seconds
    focus_mode = models.CharField(max_length=20, default='medium')  # short, medium, long
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-start_time']
        verbose_name_plural = 'Focus Sessions'
    
    def __str__(self):
        return f"{self.user.email} - Focus Session ({self.start_time})"
