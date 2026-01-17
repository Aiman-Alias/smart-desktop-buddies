"""
API views for calendar synchronization
"""
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import redirect
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from .models import CalendarConnection, CalendarEvent
from .serializers import (
    CalendarConnectionSerializer,
    CalendarEventSerializer,
    CalendarSyncStatusSerializer
)
from .services import (
    get_google_oauth_flow,
    encrypt_token,
    decrypt_token,
    fetch_google_calendars,
    get_google_credentials,
    sync_google_calendar,
    sync_all_active_calendars
)
import logging

logger = logging.getLogger(__name__)


class GoogleCalendarAuthorizeView(APIView):
    """
    Initiate Google Calendar OAuth flow
    GET /api/calendar/google/authorize/
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        try:
            redirect_uri = request.build_absolute_uri('/api/calendar/google/callback/')
            flow = get_google_oauth_flow(redirect_uri)
            
            # Store state in session for security
            authorization_url, state = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true',
                prompt='consent'  # Force consent to get refresh token
            )
            
            request.session['oauth_state'] = state
            request.session['oauth_user_id'] = request.user.id
            
            return Response({
                'authorization_url': authorization_url,
                'state': state
            })
        except Exception as e:
            logger.error(f"Error initiating OAuth: {e}")
            return Response(
                {'error': f'Failed to initiate OAuth flow: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GoogleCalendarCallbackView(APIView):
    """
    Handle Google Calendar OAuth callback
    GET /api/calendar/google/callback/?code=...&state=...
    """
    permission_classes = (permissions.AllowAny,)  # AllowAny because OAuth callback doesn't have auth header

    def get(self, request):
        code = request.GET.get('code')
        state = request.GET.get('state')
        
        # Verify state
        session_state = request.session.get('oauth_state')
        user_id = request.session.get('oauth_user_id')
        
        if not code or state != session_state:
            return Response(
                {'error': 'Invalid OAuth callback parameters'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.get(id=user_id)
            
            redirect_uri = request.build_absolute_uri('/api/calendar/google/callback/')
            flow = get_google_oauth_flow(redirect_uri)
            flow.fetch_token(code=code)
            
            credentials = flow.credentials
            
            # Fetch user's calendars
            from googleapiclient.discovery import build
            service = build('calendar', 'v3', credentials=credentials)
            calendar_list = service.calendarList().list().execute()
            
            connections_created = []
            
            # Create connection for primary calendar (or first calendar)
            primary_calendar = None
            for calendar in calendar_list.get('items', []):
                if calendar.get('primary'):
                    primary_calendar = calendar
                    break
            
            if not primary_calendar and calendar_list.get('items'):
                primary_calendar = calendar_list['items'][0]
            
            if primary_calendar:
                # Extract email from calendar_id (for Google, primary calendar ID is usually the email)
                calendar_id = primary_calendar['id']
                account_email = calendar_id if '@' in calendar_id else None
                
                connection, created = CalendarConnection.objects.get_or_create(
                    user=user,
                    provider='google',
                    calendar_id=calendar_id,
                    defaults={
                        'access_token': encrypt_token(credentials.token),
                        'refresh_token': encrypt_token(credentials.refresh_token) if credentials.refresh_token else None,
                        'token_expires_at': credentials.expiry if credentials.expiry else None,
                        'calendar_name': primary_calendar.get('summary', 'My Calendar'),
                        'account_email': account_email,
                        'is_active': True,
                        'sync_enabled': True,
                    }
                )
                
                if not created:
                    # Update existing connection
                    connection.access_token = encrypt_token(credentials.token)
                    if credentials.refresh_token:
                        connection.refresh_token = encrypt_token(credentials.refresh_token)
                    if credentials.expiry:
                        connection.token_expires_at = credentials.expiry
                    connection.is_active = True
                    if account_email and not connection.account_email:
                        connection.account_email = account_email
                    connection.save()
                
                connections_created.append(connection.calendar_name)
                
                # Trigger initial sync
                try:
                    sync_google_calendar(connection)
                except Exception as e:
                    logger.error(f"Error during initial sync: {e}")
            
            # Clear session
            request.session.pop('oauth_state', None)
            request.session.pop('oauth_user_id', None)
            
            # Redirect to frontend with success
            frontend_url = settings.CORS_ALLOWED_ORIGINS[0] if settings.CORS_ALLOWED_ORIGINS else 'http://localhost:3000'
            return redirect(f"{frontend_url}/settings?calendar_connected=true")
            
        except Exception as e:
            logger.error(f"Error handling OAuth callback: {e}")
            frontend_url = settings.CORS_ALLOWED_ORIGINS[0] if settings.CORS_ALLOWED_ORIGINS else 'http://localhost:3000'
            return redirect(f"{frontend_url}/settings?calendar_error={str(e)}")


class CalendarConnectionListView(generics.ListCreateAPIView):
    """
    List and create calendar connections
    GET /api/calendar/connections/
    """
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = CalendarConnectionSerializer

    def get_queryset(self):
        return CalendarConnection.objects.filter(user=self.request.user)
    
    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error listing calendar connections: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to fetch calendar connections: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CalendarConnectionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, or delete a calendar connection
    GET/PUT/PATCH/DELETE /api/calendar/connections/<id>/
    """
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = CalendarConnectionSerializer

    def get_queryset(self):
        return CalendarConnection.objects.filter(user=self.request.user)
    
    def perform_destroy(self, instance):
        # Delete all associated events
        CalendarEvent.objects.filter(calendar_connection=instance).delete()
        instance.delete()


class CalendarSyncView(APIView):
    """
    Trigger manual calendar sync
    POST /api/calendar/sync/
    Body: {"connection_id": <id>} or {} for all connections
    """
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        connection_id = request.data.get('connection_id')
        
        if connection_id:
            # Sync specific connection
            try:
                connection = CalendarConnection.objects.get(
                    id=connection_id,
                    user=request.user
                )
                
                if connection.provider == 'google':
                    result = sync_google_calendar(connection)
                    return Response({
                        'success': True,
                        'connection_id': connection.id,
                        'connection_name': connection.calendar_name,
                        **result
                    })
                else:
                    return Response(
                        {'error': f'Provider {connection.provider} not yet supported'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except CalendarConnection.DoesNotExist:
                return Response(
                    {'error': 'Calendar connection not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            except Exception as e:
                logger.error(f"Error syncing calendar: {e}")
                return Response(
                    {'error': f'Sync failed: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            # Sync all user's calendars
            results = sync_all_active_calendars(user=request.user)
            return Response({
                'success': True,
                'results': results
            })


class CalendarEventListView(generics.ListAPIView):
    """
    List calendar events
    GET /api/calendar/events/?start_date=...&end_date=...
    """
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = CalendarEventSerializer

    def get_queryset(self):
        queryset = CalendarEvent.objects.filter(user=self.request.user)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(start_time__gte=start_date)
        if end_date:
            queryset = queryset.filter(start_time__lte=end_date)
        
        return queryset.order_by('start_time')


class UpcomingEventsView(APIView):
    """
    Get upcoming calendar events with pagination
    GET /api/calendar/events/upcoming/?days=30&page=1&page_size=5
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 5))
        
        now = timezone.now()
        end_date = now + timedelta(days=days)
        
        # Get all events in the date range, ordered by start_time (closest first)
        all_events = CalendarEvent.objects.filter(
            user=request.user,
            start_time__gte=now,
            start_time__lte=end_date
        ).order_by('start_time')
        
        total_count = all_events.count()
        
        # Calculate pagination
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        
        # Get events for current page
        events = all_events[start_index:end_index]
        
        serializer = CalendarEventSerializer(events, many=True)
        
        # Calculate total pages
        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
        
        return Response({
            'events': serializer.data,
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_previous': page > 1
        })


class CalendarSyncStatusView(APIView):
    """
    Get sync status for all user's calendar connections
    GET /api/calendar/sync/status/
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        connections = CalendarConnection.objects.filter(user=request.user)
        
        status_data = []
        for connection in connections:
            event_count = CalendarEvent.objects.filter(calendar_connection=connection).count()
            
            status_data.append({
                'connection_id': connection.id,
                'connection_name': connection.calendar_name,
                'provider': connection.provider,
                'last_synced_at': connection.last_synced_at,
                'sync_enabled': connection.sync_enabled,
                'is_active': connection.is_active,
                'event_count': event_count,
                'needs_refresh': connection.needs_refresh(),
            })
        
        serializer = CalendarSyncStatusSerializer(status_data, many=True)
        return Response(serializer.data)

