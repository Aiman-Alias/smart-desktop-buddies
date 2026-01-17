from django.urls import path
from . import views

urlpatterns = [
    path('', views.MoodEntryListCreateView.as_view(), name='mood-list-create'),
    path('<int:pk>/', views.MoodEntryDetailView.as_view(), name='mood-detail'),
    path('stats/', views.MoodStatsView.as_view(), name='mood-stats'),
] 