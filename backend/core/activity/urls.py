from django.urls import path
from . import views
from .views import BehaviorStatsView, AnalyticsView, FocusSessionListCreateView, FocusSessionDetailView

urlpatterns = [
    path('', views.ActivityListCreateView.as_view(), name='activity-list-create'),
    path('<int:pk>/', views.ActivityDetailView.as_view(), name='activity-detail'),
    path('stats/', views.ActivityStatsView.as_view(), name='activity-stats'),
    path('behavior-stats/', BehaviorStatsView.as_view(), name='behavior-stats'),
    path('analytics/', AnalyticsView.as_view(), name='analytics'),
    path('focus-sessions/', FocusSessionListCreateView.as_view(), name='focus-session-list-create'),
    path('focus-sessions/<int:pk>/', FocusSessionDetailView.as_view(), name='focus-session-detail'),
] 