from django.contrib import admin
from .models import CalendarConnection, CalendarEvent

@admin.register(CalendarConnection)
class CalendarConnectionAdmin(admin.ModelAdmin):
    list_display = ['user', 'provider', 'calendar_name', 'is_active', 'sync_enabled', 'last_synced_at', 'created_at']
    list_filter = ['provider', 'is_active', 'sync_enabled', 'created_at']
    search_fields = ['user__username', 'user__email', 'calendar_name']
    readonly_fields = ['created_at', 'updated_at', 'last_synced_at']
    
    fieldsets = (
        ('User & Provider', {
            'fields': ('user', 'provider')
        }),
        ('Calendar Information', {
            'fields': ('calendar_id', 'calendar_name')
        }),
        ('OAuth Tokens', {
            'fields': ('access_token', 'refresh_token', 'token_expires_at'),
            'classes': ('collapse',)
        }),
        ('Sync Settings', {
            'fields': ('is_active', 'sync_enabled', 'last_synced_at')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'calendar_connection', 'start_time', 'end_time', 'all_day', 'created_at']
    list_filter = ['all_day', 'calendar_connection__provider', 'start_time', 'created_at']
    search_fields = ['title', 'description', 'location', 'user__username']
    readonly_fields = ['created_at', 'updated_at', 'last_modified']
    date_hierarchy = 'start_time'
    
    fieldsets = (
        ('Event Information', {
            'fields': ('user', 'calendar_connection', 'external_event_id')
        }),
        ('Event Details', {
            'fields': ('title', 'description', 'location')
        }),
        ('Time Information', {
            'fields': ('start_time', 'end_time', 'all_day', 'timezone', 'recurrence_rule')
        }),
        ('Metadata', {
            'fields': ('last_modified', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

