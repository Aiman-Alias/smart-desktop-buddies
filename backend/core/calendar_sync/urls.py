from django.urls import path
from . import views

urlpatterns = [
    # OAuth endpoints
    path('google/authorize/', views.GoogleCalendarAuthorizeView.as_view(), name='google-calendar-authorize'),
    path('google/callback/', views.GoogleCalendarCallbackView.as_view(), name='google-calendar-callback'),
    
    # Connection management
    path('connections/', views.CalendarConnectionListView.as_view(), name='calendar-connection-list'),
    path('connections/<int:pk>/', views.CalendarConnectionDetailView.as_view(), name='calendar-connection-detail'),
    
    # Sync operations
    path('sync/', views.CalendarSyncView.as_view(), name='calendar-sync'),
    path('sync/status/', views.CalendarSyncStatusView.as_view(), name='calendar-sync-status'),
    
    # Events
    path('events/', views.CalendarEventListView.as_view(), name='calendar-event-list'),
    path('events/upcoming/', views.UpcomingEventsView.as_view(), name='calendar-events-upcoming'),
]

