from rest_framework import generics, permissions
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta
from .models import Activity, FocusSession
from .serializers import ActivitySerializer, FocusSessionSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class ActivityListCreateView(generics.ListCreateAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = ActivitySerializer

    def get_queryset(self):
        return Activity.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ActivityDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = ActivitySerializer

    def get_queryset(self):
        return Activity.objects.filter(user=self.request.user)

class ActivityStatsView(generics.ListAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = ActivitySerializer

    def get_queryset(self):
        return Activity.objects.filter(user=self.request.user).values('activity_type').annotate(
            total_duration=Sum('end_time' - 'start_time')
        )

class BehaviorStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # TODO: Replace with real calculations
        data = {
            'app_usage_hours': 5.2,
            'idle_time_minutes': 45,
            'screen_time_hours': 6.5,
            'burnout_detected': False,
            'suggestions': [
                'Take a 5-minute break every hour.',
                'Try a short breathing exercise.',
                'Review your task list and prioritize.'
            ]
        }
        return Response(data)

class AnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        days = int(request.query_params.get('days', 7))
        
        start_date = now - timedelta(days=days)
        
        # Get tasks data
        from tasks.models import Task
        tasks = Task.objects.filter(user=user, updated_at__gte=start_date)
        completed_tasks = tasks.filter(status='completed')
        
        # Get mood data
        from mood_tracker.models import MoodEntry
        mood_entries = MoodEntry.objects.filter(user=user, created_at__gte=start_date)
        
        # Get focus sessions
        focus_sessions = FocusSession.objects.filter(user=user, start_time__gte=start_date)
        total_focus_seconds = sum(session.duration_seconds for session in focus_sessions if session.duration_seconds)
        
        # Daily breakdown
        daily_data = []
        for i in range(days):
            day = now - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            day_tasks = tasks.filter(updated_at__gte=day_start, updated_at__lte=day_end)
            day_completed = day_tasks.filter(status='completed').count()
            
            day_mood = mood_entries.filter(created_at__gte=day_start, created_at__lte=day_end).first()
            mood_value = None
            if day_mood:
                mood_map = {'very_happy': 3, 'happy': 3, 'neutral': 2, 'sad': 1, 'very_sad': 1}
                mood_value = mood_map.get(day_mood.mood, 2)
            
            day_focus = focus_sessions.filter(start_time__gte=day_start, start_time__lte=day_end)
            day_focus_minutes = sum(s.duration_seconds for s in day_focus if s.duration_seconds) // 60
            
            daily_data.append({
                'date': day_start.date().isoformat(),
                'focusTime': day_focus_minutes,
                'tasksCompleted': day_completed,
                'mood': mood_value,
                'screenTime': 0,  # Placeholder - would need screen activity tracking
                'breaks': 0,  # Placeholder - would need break tracking
            })
        
        daily_data.reverse()  # Oldest to newest
        
        return Response({
            'daily_data': daily_data,
            'summary': {
                'total_focus_minutes': total_focus_seconds // 60,
                'total_tasks_completed': completed_tasks.count(),
                'total_tasks': tasks.count(),
                'avg_mood': self._calculate_avg_mood(mood_entries),
            }
        })
    
    def _calculate_avg_mood(self, mood_entries):
        if not mood_entries.exists():
            return 0
        mood_map = {'very_happy': 3, 'happy': 3, 'neutral': 2, 'sad': 1, 'very_sad': 1}
        total = sum(mood_map.get(entry.mood, 2) for entry in mood_entries)
        return round(total / mood_entries.count(), 1)

class FocusSessionListCreateView(generics.ListCreateAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = FocusSessionSerializer

    def get_queryset(self):
        return FocusSession.objects.filter(user=self.request.user).order_by('-start_time')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class FocusSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = FocusSessionSerializer

    def get_queryset(self):
        return FocusSession.objects.filter(user=self.request.user) 