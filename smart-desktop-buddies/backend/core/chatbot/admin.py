from django.contrib import admin
from .models import ChatMessage

@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'content', 'created_at']
    list_filter = ['role', 'created_at', 'user']
    search_fields = ['content', 'user__username']
    readonly_fields = ['created_at']
    ordering = ['-created_at']