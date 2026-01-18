from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import UserSerializer
from .utils import generate_verification_token, send_verification_email, generate_password_reset_token, send_password_reset_email
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
import logging

logger = logging.getLogger(__name__)

User = get_user_model()

class RegisterView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        try:
            serializer = UserSerializer(data=request.data)
            if serializer.is_valid():
                user = serializer.save()
                
                # Generate verification token
                verification_token = generate_verification_token()
                user.email_verification_token = verification_token
                user.email_verified = False
                user.save()
                
                # Send verification email
                email_sent = send_verification_email(user, verification_token)
                
                if not email_sent:
                    logger.warning(f"Failed to send verification email to {user.email}")
                
                # Don't return tokens until email is verified
                # User needs to verify email first
                return Response({
                    'message': 'Registration successful! Please check your email to verify your account.',
                    'email_sent': email_sent,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'email_verified': user.email_verified
                    }
                }, status=status.HTTP_201_CREATED)
            
            # Return validation errors
            logger.error(f"Registration validation failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Registration error: {str(e)}", exc_info=True)
            return Response(
                {'error': f'An error occurred during registration: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class LoginView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response(
                {'error': 'Please provide both email and password'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(username=email, password=password)

        if not user:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Check if email is verified
        if not user.email_verified:
            return Response(
                {
                    'error': 'Please verify your email before logging in. Check your inbox for the verification link.',
                    'email_verified': False
                },
                status=status.HTTP_403_FORBIDDEN
            )

        refresh = RefreshToken.for_user(user)
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data
        })

class UserProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')

        if not current_password or not new_password:
            return Response(
                {'error': 'Both current password and new password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user

        # Verify current password
        if not user.check_password(current_password):
            return Response(
                {'error': 'Current password is incorrect'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if new password is different from current password
        if user.check_password(new_password):
            return Response(
                {'error': 'New password must be different from your current password'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate password strength (Django's default validators)
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError

        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return Response(
                {'error': '; '.join(e.messages)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Set new password
        user.set_password(new_password)
        user.save()

        return Response(
            {'message': 'Password changed successfully'},
            status=status.HTTP_200_OK
        )


class VerifyEmailView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        token = request.query_params.get('token')
        email = request.query_params.get('email')

        if not token or not email:
            return Response(
                {'error': 'Token and email are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email, email_verification_token=token)
            
            if user.email_verified:
                return Response(
                    {'message': 'Email is already verified. You can now log in.'},
                    status=status.HTTP_200_OK
                )
            
            # Verify the email
            user.email_verified = True
            user.email_verification_token = None  # Clear token after verification
            user.save()
            
            return Response(
                {'message': 'Email verified successfully! You can now log in.'},
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid verification token or email'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error verifying email: {e}")
            return Response(
                {'error': 'An error occurred during verification'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ForgotPasswordView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        email = request.data.get('email')

        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email)
            
            # Generate password reset token
            reset_token = generate_password_reset_token()
            user.password_reset_token = reset_token
            user.password_reset_token_expires = timezone.now() + timedelta(hours=1)  # Token expires in 1 hour
            user.save()
            
            # Send password reset email
            email_sent = send_password_reset_email(user, reset_token)
            
            if not email_sent:
                logger.warning(f"Failed to send password reset email to {user.email}")
            
            # Always return success message (for security - don't reveal if email exists)
            return Response(
                {'message': 'If an account with that email exists, a password reset link has been sent.'},
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            # Don't reveal if email exists for security reasons
            return Response(
                {'message': 'If an account with that email exists, a password reset link has been sent.'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Error in forgot password: {e}", exc_info=True)
            return Response(
                {'error': 'An error occurred. Please try again later.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ResetPasswordView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        token = request.data.get('token')
        email = request.data.get('email')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not token or not email or not new_password or not confirm_password:
            return Response(
                {'error': 'Token, email, new password, and confirm password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_password != confirm_password:
            return Response(
                {'error': 'Passwords do not match'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email, password_reset_token=token)
            
            # Check if token is valid and not expired
            if not user.is_password_reset_token_valid():
                return Response(
                    {'error': 'Password reset link has expired. Please request a new one.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate password strength
            try:
                validate_password(new_password, user)
            except ValidationError as e:
                return Response(
                    {'error': '; '.join(e.messages)},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if new password is different from current password
            if user.check_password(new_password):
                return Response(
                    {'error': 'New password must be different from your current password'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Set new password
            user.set_password(new_password)
            # Clear reset token after successful reset
            user.password_reset_token = None
            user.password_reset_token_expires = None
            user.save()
            
            return Response(
                {'message': 'Password has been reset successfully. You can now log in with your new password.'},
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired password reset link'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error resetting password: {e}", exc_info=True)
            return Response(
                {'error': 'An error occurred during password reset'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 