from rest_framework import serializers
from .models import Quote, Goal

class QuoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quote
        fields = ['id', 'text', 'author', 'created_at']
        read_only_fields = ['created_at']

class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = ['id', 'title', 'description', 'target_date', 'status', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at'] 