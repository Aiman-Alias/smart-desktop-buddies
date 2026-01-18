"""
Service functions for calendar synchronization
"""
import os
from datetime import datetime, timedelta
from django.utils import timezone
from django.conf import settings as django_settings
from cryptography.fernet import Fernet
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from .models import CalendarConnection, CalendarEvent
import logging

logger = logging.getLogger(__name__)

# Encryption key for tokens (from Django settings)
ENCRYPTION_KEY = django_settings.ENCRYPTION_KEY
if not ENCRYPTION_KEY:
    # Generate a key if not set (for development only - should be set in production)
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    logger.warning("ENCRYPTION_KEY not set! Generated a temporary key. This should be set in production!")

try:
    cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
except Exception as e:
    logger.error(f"Error initializing encryption: {e}")
    # Fallback: generate new key
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)


def encrypt_token(token):
    """Encrypt a token for storage"""
    if not token:
        return None
    return cipher_suite.encrypt(token.encode()).decode()


def decrypt_token(encrypted_token):
    """Decrypt a stored token"""
    if not encrypted_token:
        return None
    try:
        return cipher_suite.decrypt(encrypted_token.encode()).decode()
    except Exception as e:
        logger.error(f"Error decrypting token: {e}")
        return None


def get_google_oauth_flow(redirect_uri=None):
    """Create Google OAuth flow"""
    client_id = django_settings.GOOGLE_CLIENT_ID
    client_secret = django_settings.GOOGLE_CLIENT_SECRET
    
    if not client_id or not client_secret:
        raise ValueError(
            "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in environment variables or .env file. "
            "Please set them in your .env file or as environment variables."
        )
    
    # Use redirect_uri from parameter or settings
    if not redirect_uri:
        redirect_uri = django_settings.GOOGLE_REDIRECT_URI
    
    scopes = ['https://www.googleapis.com/auth/calendar.readonly']
    
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri]
            }
        },
        scopes=scopes
    )
    flow.redirect_uri = redirect_uri
    return flow


def get_google_credentials(connection):
    """Get Google API credentials from connection"""
    access_token = decrypt_token(connection.access_token)
    refresh_token = decrypt_token(connection.refresh_token) if connection.refresh_token else None
    
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=django_settings.GOOGLE_CLIENT_ID,
        client_secret=django_settings.GOOGLE_CLIENT_SECRET,
    )
    
    # Refresh token if expired or will expire soon (within 1 hour)
    from datetime import timedelta
    should_refresh = False
    if creds.expired:
        should_refresh = True
    elif creds.expiry and creds.expiry - timezone.now() < timedelta(hours=1):
        # Token will expire within 1 hour, refresh proactively
        should_refresh = True
    
    if should_refresh and creds.refresh_token:
        try:
            creds.refresh(Request())
            # Update stored tokens
            connection.access_token = encrypt_token(creds.token)
            if creds.expiry:
                connection.token_expires_at = creds.expiry
            connection.save()
            logger.info(f"Token refreshed for connection {connection.id}")
        except Exception as e:
            logger.error(f"Error refreshing token: {e}")
            raise
    
    return creds


def fetch_google_calendars(credentials):
    """Fetch list of user's Google calendars"""
    try:
        service = build('calendar', 'v3', credentials=credentials)
        calendar_list = service.calendarList().list().execute()
        return calendar_list.get('items', [])
    except HttpError as error:
        logger.error(f"Error fetching calendars: {error}")
        raise


def fetch_google_events(credentials, calendar_id, time_min=None, time_max=None, max_results=250):
    """
    Fetch events from Google Calendar
    
    Args:
        credentials: Google API credentials
        calendar_id: Calendar ID to fetch from
        time_min: Start time (datetime or ISO string). Defaults to now (excludes past events)
        time_max: End time (datetime or ISO string). Defaults to 30 days ahead
        max_results: Maximum number of results
    
    Returns:
        List of event dictionaries (only future events, up to 30 days ahead)
    """
    try:
        service = build('calendar', 'v3', credentials=credentials)
        
        # Default to now (exclude past events) and next 30 days
        if not time_min:
            time_min = timezone.now()
        if not time_max:
            time_max = timezone.now() + timedelta(days=30)
        
        # Convert datetime to RFC3339 format (required by Google Calendar API)
        if isinstance(time_min, datetime):
            time_min = time_min.strftime('%Y-%m-%dT%H:%M:%SZ')
        if isinstance(time_max, datetime):
            time_max = time_max.strftime('%Y-%m-%dT%H:%M:%SZ')
        
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            maxResults=max_results,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        return events_result.get('items', [])
    except HttpError as error:
        logger.error(f"Error fetching events: {error}")
        raise


def parse_google_event(event_data):
    """Parse Google Calendar event data into our format"""
    event_id = event_data.get('id')
    title = event_data.get('summary', 'No Title')
    description = event_data.get('description', '')
    location = event_data.get('location', '')
    
    # Parse start time
    start_data = event_data.get('start', {})
    if 'dateTime' in start_data:
        start_time = datetime.fromisoformat(start_data['dateTime'].replace('Z', '+00:00'))
        all_day = False
    else:
        start_time = datetime.fromisoformat(start_data['date'] + 'T00:00:00+00:00')
        all_day = True
    
    # Parse end time
    end_data = event_data.get('end', {})
    if 'dateTime' in end_data:
        end_time = datetime.fromisoformat(end_data['dateTime'].replace('Z', '+00:00'))
    else:
        end_time = datetime.fromisoformat(end_data['date'] + 'T23:59:59+00:00')
    
    # Recurrence rule
    recurrence = event_data.get('recurrence', [])
    recurrence_rule = recurrence[0] if recurrence else None
    
    # Last modified
    last_modified = datetime.fromisoformat(
        event_data.get('updated', event_data.get('created', '')).replace('Z', '+00:00')
    )
    
    return {
        'external_event_id': event_id,
        'title': title,
        'description': description,
        'location': location,
        'start_time': start_time,
        'end_time': end_time,
        'all_day': all_day,
        'recurrence_rule': recurrence_rule,
        'last_modified': last_modified,
    }


def sync_google_calendar(connection):
    """
    Sync events from Google Calendar to local database
    
    Args:
        connection: CalendarConnection instance
    
    Returns:
        dict with sync results
    """
    if connection.provider != 'google':
        raise ValueError(f"Connection is not a Google Calendar connection")
    
    if not connection.is_active or not connection.sync_enabled:
        logger.info(f"Skipping sync for inactive/disabled connection: {connection.id}")
        return {'synced': 0, 'created': 0, 'updated': 0, 'deleted': 0, 'errors': []}
    
    try:
        credentials = get_google_credentials(connection)
        events_data = fetch_google_events(credentials, connection.calendar_id)
        
        synced_count = 0
        created_count = 0
        updated_count = 0
        errors = []
        
        # Get existing events for this calendar
        existing_events = {
            event.external_event_id: event
            for event in CalendarEvent.objects.filter(calendar_connection=connection)
        }
        
        # Process fetched events
        external_event_ids = set()
        for event_data in events_data:
            try:
                parsed_event = parse_google_event(event_data)
                external_event_id = parsed_event['external_event_id']
                external_event_ids.add(external_event_id)
                
                if external_event_id in existing_events:
                    # Update existing event
                    event = existing_events[external_event_id]
                    # Only update if external calendar has newer version
                    if parsed_event['last_modified'] > event.last_modified:
                        for key, value in parsed_event.items():
                            if key != 'external_event_id':
                                setattr(event, key, value)
                        event.save()
                        updated_count += 1
                else:
                    # Create new event
                    CalendarEvent.objects.create(
                        user=connection.user,
                        calendar_connection=connection,
                        **parsed_event
                    )
                    created_count += 1
                
                synced_count += 1
            except Exception as e:
                logger.error(f"Error processing event: {e}")
                errors.append(str(e))
        
        # Delete events that no longer exist in external calendar
        deleted_count = 0
        for external_event_id, event in existing_events.items():
            if external_event_id not in external_event_ids:
                event.delete()
                deleted_count += 1
        
        # Also delete any past events that are older than now (cleanup)
        now = timezone.now()
        past_events = CalendarEvent.objects.filter(
            calendar_connection=connection,
            end_time__lt=now
        )
        past_events_count = past_events.count()
        past_events.delete()
        if past_events_count > 0:
            deleted_count += past_events_count
            logger.info(f"Cleaned up {past_events_count} past events for connection {connection.id}")
        
        # Update last synced timestamp
        connection.last_synced_at = timezone.now()
        connection.save()
        
        return {
            'synced': synced_count,
            'created': created_count,
            'updated': updated_count,
            'deleted': deleted_count,
            'errors': errors
        }
    
    except Exception as e:
        logger.error(f"Error syncing Google Calendar: {e}")
        raise


def sync_all_active_calendars(user=None):
    """
    Sync all active calendar connections
    
    Args:
        user: Optional user to sync only their calendars
    
    Returns:
        List of sync results
    """
    connections = CalendarConnection.objects.filter(
        is_active=True,
        sync_enabled=True
    )
    
    if user:
        connections = connections.filter(user=user)
    
    results = []
    for connection in connections:
        try:
            if connection.provider == 'google':
                result = sync_google_calendar(connection)
                result['connection_id'] = connection.id
                result['connection_name'] = connection.calendar_name
                results.append(result)
            # Add other providers here (outlook, apple)
        except Exception as e:
            logger.error(f"Error syncing connection {connection.id}: {e}")
            results.append({
                'connection_id': connection.id,
                'connection_name': connection.calendar_name,
                'error': str(e)
            })
    
    return results

