from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count
import requests
from .models import Quote, Goal
from .serializers import QuoteSerializer, GoalSerializer

class QuoteListView(generics.ListAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    queryset = Quote.objects.all()
    serializer_class = QuoteSerializer

class RandomQuoteView(generics.RetrieveAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = QuoteSerializer

    def get_object(self):
        return Quote.objects.order_by('?').first()

class GoalListCreateView(generics.ListCreateAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = GoalSerializer

    def get_queryset(self):
        return Goal.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class GoalDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = GoalSerializer

    def get_queryset(self):
        return Goal.objects.filter(user=self.request.user)

class ZenQuoteView(APIView):
    """
    Fetches motivational quotes from ZenQuotes.io API
    Supports: random, today, or multiple quotes
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        quote_type = request.query_params.get('type', 'random')  # random, today, or quotes
        
        try:
            if quote_type == 'today':
                # Get quote of the day
                url = 'https://zenquotes.io/api/today'
            elif quote_type == 'quotes':
                # Get 50 random quotes
                url = 'https://zenquotes.io/api/quotes'
            else:
                # Get single random quote (default)
                url = 'https://zenquotes.io/api/random'
            
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            data = response.json()
            
            # ZenQuotes API returns array with format: [{"q": "quote text", "a": "author", "h": "html"}]
            if isinstance(data, list) and len(data) > 0:
                # If multiple quotes requested, return all; otherwise return first
                if quote_type == 'quotes':
                    quotes = [{'text': item.get('q', ''), 'author': item.get('a', 'Unknown')} for item in data]
                    return Response({'quotes': quotes, 'count': len(quotes)})
                else:
                    quote = data[0]
                    return Response({
                        'text': quote.get('q', ''),
                        'author': quote.get('a', 'Unknown'),
                        'html': quote.get('h', '')
                    })
            else:
                return Response(
                    {'error': 'No quotes found'},
                    status=status.HTTP_404_NOT_FOUND
                )
                
        except requests.exceptions.RequestException as e:
            return Response(
                {'error': f'Failed to fetch quote from ZenQuotes: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as e:
            return Response(
                {'error': f'Unexpected error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 