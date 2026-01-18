from rest_framework import serializers
from .models import Activity, FocusSession

class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = ['id', 'activity_type', 'description', 'start_time', 'end_time', 'created_at']
        read_only_fields = ['created_at']

class FocusSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FocusSession
        fields = ['id', 'start_time', 'end_time', 'duration_seconds', 'focus_mode', 'created_at']
        read_only_fields = ['created_at'] 