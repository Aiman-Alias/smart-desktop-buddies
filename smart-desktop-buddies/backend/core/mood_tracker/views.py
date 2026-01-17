from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count, Avg, Q
from django.utils import timezone
from datetime import timedelta
from .models import MoodEntry
from .serializers import MoodEntrySerializer

class MoodEntryListCreateView(generics.ListCreateAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = MoodEntrySerializer

    def get_queryset(self):
        return MoodEntry.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class MoodEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = MoodEntrySerializer

    def get_queryset(self):
        return MoodEntry.objects.filter(user=self.request.user)

class MoodStatsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        now = timezone.now()
        
        # Mood counts by type
        mood_counts = MoodEntry.objects.filter(user=user).values('mood').annotate(count=Count('mood'))
        
        # Weekly trend (last 7 days)
        week_ago = now - timedelta(days=7)
        weekly_entries = MoodEntry.objects.filter(
            user=user,
            created_at__gte=week_ago
        ).order_by('created_at')
        
        # Monthly trend (last 30 days)
        month_ago = now - timedelta(days=30)
        monthly_entries = MoodEntry.objects.filter(
            user=user,
            created_at__gte=month_ago
        ).order_by('created_at')
        
        # Calculate average mood values
        mood_value_map = {
            'very_happy': 5,
            'happy': 4,
            'neutral': 3,
            'sad': 2,
            'very_sad': 1,
        }
        
        # Weekly average
        weekly_avg = 0
        if weekly_entries.exists():
            total = sum(mood_value_map.get(entry.mood, 3) for entry in weekly_entries)
            weekly_avg = round(total / weekly_entries.count(), 2)
        
        # Monthly average
        monthly_avg = 0
        if monthly_entries.exists():
            total = sum(mood_value_map.get(entry.mood, 3) for entry in monthly_entries)
            monthly_avg = round(total / monthly_entries.count(), 2)
        
        # Overall average
        all_entries = MoodEntry.objects.filter(user=user)
        overall_avg = 0
        if all_entries.exists():
            total = sum(mood_value_map.get(entry.mood, 3) for entry in all_entries)
            overall_avg = round(total / all_entries.count(), 2)
        
        # Daily breakdown for last 7 days
        daily_breakdown = []
        for i in range(7):
            day = now - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            day_entries = MoodEntry.objects.filter(
                user=user,
                created_at__gte=day_start,
                created_at__lte=day_end
            )
            
            if day_entries.exists():
                day_avg = sum(mood_value_map.get(entry.mood, 3) for entry in day_entries) / day_entries.count()
                daily_breakdown.append({
                    'date': day_start.date().isoformat(),
                    'average': round(day_avg, 2),
                    'count': day_entries.count()
                })
            else:
                daily_breakdown.append({
                    'date': day_start.date().isoformat(),
                    'average': None,
                    'count': 0
                })
        
        daily_breakdown.reverse()  # Oldest to newest
        
        # Weekly breakdown (last 4 weeks)
        weekly_breakdown = []
        for i in range(4):
            week_start = now - timedelta(weeks=i+1)
            week_end = now - timedelta(weeks=i)
            
            week_entries = MoodEntry.objects.filter(
                user=user,
                created_at__gte=week_start,
                created_at__lt=week_end
            )
            
            if week_entries.exists():
                week_avg = sum(mood_value_map.get(entry.mood, 3) for entry in week_entries) / week_entries.count()
                weekly_breakdown.append({
                    'week_start': week_start.date().isoformat(),
                    'week_end': week_end.date().isoformat(),
                    'average': round(week_avg, 2),
                    'count': week_entries.count()
                })
            else:
                weekly_breakdown.append({
                    'week_start': week_start.date().isoformat(),
                    'week_end': week_end.date().isoformat(),
                    'average': None,
                    'count': 0
                })
        
        weekly_breakdown.reverse()
        
        # Pattern detection
        patterns = []
        
        # Check for improving trend
        if len(weekly_breakdown) >= 2:
            recent_weeks = [w for w in weekly_breakdown if w['average'] is not None]
            if len(recent_weeks) >= 2:
                if recent_weeks[-1]['average'] > recent_weeks[-2]['average']:
                    patterns.append({
                        'type': 'improving',
                        'message': 'Your mood has been improving recently'
                    })
                elif recent_weeks[-1]['average'] < recent_weeks[-2]['average']:
                    patterns.append({
                        'type': 'declining',
                        'message': 'Your mood has been declining recently. Consider taking breaks or seeking support.'
                    })
        
        # Check for consistency
        if daily_breakdown:
            valid_days = [d for d in daily_breakdown if d['average'] is not None]
            if len(valid_days) >= 3:
                values = [d['average'] for d in valid_days]
                variance = max(values) - min(values)
                if variance < 1.0:
                    patterns.append({
                        'type': 'consistent',
                        'message': 'Your mood has been relatively stable'
                    })
        
        return Response({
            'mood_counts': list(mood_counts),
            'averages': {
                'weekly': weekly_avg,
                'monthly': monthly_avg,
                'overall': overall_avg
            },
            'daily_breakdown': daily_breakdown,
            'weekly_breakdown': weekly_breakdown,
            'patterns': patterns,
            'total_entries': all_entries.count()
        }) 