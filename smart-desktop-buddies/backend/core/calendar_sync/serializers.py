from rest_framework import serializers
from .models import CalendarConnection, CalendarEvent
from django.contrib.auth import get_user_model

User = get_user_model()


class CalendarConnectionSerializer(serializers.ModelSerializer):
    """Serializer for calendar connections"""
    provider_display = serializers.CharField(source='get_provider_display', read_only=True)
    needs_refresh = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = CalendarConnection
        fields = [
            'id', 'provider', 'provider_display', 'calendar_id', 'calendar_name',
            'account_email', 'is_active', 'sync_enabled', 'last_synced_at', 'needs_refresh',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_synced_at']
    
    def validate(self, data):
        """Ensure user can only have one active connection per provider/calendar"""
        user = self.context['request'].user
        provider = data.get('provider')
        calendar_id = data.get('calendar_id')
        
        if self.instance:
            # Update: check for duplicates excluding current instance
            existing = CalendarConnection.objects.filter(
                user=user,
                provider=provider,
                calendar_id=calendar_id
            ).exclude(pk=self.instance.pk)
        else:
            # Create: check for any duplicates
            existing = CalendarConnection.objects.filter(
                user=user,
                provider=provider,
                calendar_id=calendar_id
            )
        
        if existing.exists():
            raise serializers.ValidationError(
                f"You already have a connection to this {provider} calendar."
            )
        
        return data


class CalendarEventSerializer(serializers.ModelSerializer):
    """Serializer for calendar events"""
    calendar_connection_name = serializers.CharField(
        source='calendar_connection.calendar_name',
        read_only=True
    )
    provider = serializers.CharField(
        source='calendar_connection.provider',
        read_only=True
    )
    is_upcoming = serializers.BooleanField(read_only=True)
    is_today = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = CalendarEvent
        fields = [
            'id', 'external_event_id', 'title', 'description', 'location',
            'start_time', 'end_time', 'all_day', 'timezone', 'recurrence_rule',
            'calendar_connection', 'calendar_connection_name', 'provider',
            'is_upcoming', 'is_today', 'last_modified',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'external_event_id', 'last_modified',
            'created_at', 'updated_at'
        ]


class CalendarSyncStatusSerializer(serializers.Serializer):
    """Serializer for sync status information"""
    connection_id = serializers.IntegerField()
    connection_name = serializers.CharField()
    provider = serializers.CharField()
    last_synced_at = serializers.DateTimeField(allow_null=True)
    sync_enabled = serializers.BooleanField()
    is_active = serializers.BooleanField()
    event_count = serializers.IntegerField()
    needs_refresh = serializers.BooleanField()

