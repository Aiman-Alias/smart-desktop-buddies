from django.urls import path
from . import views

urlpatterns = [
    path('messages/', views.ChatMessageListView.as_view(), name='chat-messages'),
    path('messages/<int:pk>/', views.ChatMessageDetailView.as_view(), name='chat-message-detail'),
    path('chat/', views.ChatView.as_view(), name='chat'),
]