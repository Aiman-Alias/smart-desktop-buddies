from rest_framework import serializers
from django.utils import timezone
from datetime import datetime
from .models import MoodEntry

class MoodEntrySerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(required=False, allow_null=True, read_only=False)
    
    class Meta:
        model = MoodEntry
        fields = ['id', 'mood', 'note', 'created_at']
        read_only_fields = ['id']  # ID is always read-only
    
    def update(self, instance, validated_data):
        # Remove created_at from validated_data during updates to preserve original timestamp
        validated_data.pop('created_at', None)
        return super().update(instance, validated_data)
    
    def create(self, validated_data):
        # Extract created_at if provided
        created_at = validated_data.pop('created_at', None)
        
        # Parse created_at if it's a string
        parsed_created_at = None
        if created_at:
            if isinstance(created_at, str):
                # Handle ISO format with or without timezone
                try:
                    if created_at.endswith('Z'):
                        # UTC timezone - remove Z and add +00:00
                        dt_str = created_at.replace('Z', '+00:00')
                        dt = datetime.fromisoformat(dt_str)
                        parsed_created_at = timezone.make_aware(dt, timezone.utc) if timezone.is_naive(dt) else dt
                    elif '+' in created_at or created_at.count('-') >= 3:
                        # Has timezone info
                        dt = datetime.fromisoformat(created_at)
                        parsed_created_at = timezone.make_aware(dt, timezone.utc) if timezone.is_naive(dt) else dt
                    else:
                        # Naive datetime, assume UTC
                        dt = datetime.fromisoformat(created_at)
                        parsed_created_at = timezone.make_aware(dt, timezone.utc)
                except (ValueError, AttributeError) as e:
                    # Fallback to current time if parsing fails
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Error parsing created_at: {e}, value: {created_at}")
                    parsed_created_at = timezone.now()
            else:
                parsed_created_at = created_at
        
        # Create instance with all fields including user (from perform_create)
        instance = MoodEntry(**validated_data)
        
        # Save first (Django will set auto_now_add)
        instance.save()
        
        # Now update created_at if we have a custom value
        # This bypasses auto_now_add by using update()
        if parsed_created_at:
            MoodEntry.objects.filter(pk=instance.pk).update(created_at=parsed_created_at)
            instance.refresh_from_db()
        
        return instance 