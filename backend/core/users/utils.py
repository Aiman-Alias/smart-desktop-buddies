"""
Utility functions for user management
"""
import secrets
import hashlib
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils import timezone
from datetime import timedelta


def generate_verification_token():
    """Generate a secure random token for email verification"""
    return secrets.token_urlsafe(32)


def generate_password_reset_token():
    """Generate a secure random token for password reset"""
    return secrets.token_urlsafe(32)


def send_verification_email(user, token):
    """
    Send email verification email to user
    
    Args:
        user: User instance
        token: Verification token
    """
    # Get FRONTEND_URL with fallback
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    verification_url = f"{frontend_url}/verify-email?token={token}&email={user.email}"
    
    # Email subject
    subject = "Verify Your Email - Smart Desktop Buddies"
    
    # Email body (HTML)
    html_message = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .container {{
                background-color: #f9fafb;
                border-radius: 8px;
                padding: 30px;
                border: 1px solid #e5e7eb;
            }}
            .header {{
                text-align: center;
                margin-bottom: 30px;
            }}
            .logo {{
                font-size: 24px;
                font-weight: bold;
                background: linear-gradient(to right, #3b82f6, #8b5cf6);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }}
            .content {{
                background-color: white;
                padding: 25px;
                border-radius: 6px;
                margin-bottom: 20px;
            }}
            .button {{
                display: inline-block;
                padding: 12px 30px;
                background: linear-gradient(to right, #3b82f6, #8b5cf6);
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                margin: 20px 0;
            }}
            .button:hover {{
                opacity: 0.9;
            }}
            .footer {{
                text-align: center;
                color: #6b7280;
                font-size: 12px;
                margin-top: 20px;
            }}
            .link {{
                color: #3b82f6;
                word-break: break-all;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">Smart Desktop Buddies</div>
            </div>
            
            <div class="content">
                <h2>Welcome, {user.username}! 👋</h2>
                
                <p>Thank you for signing up for Smart Desktop Buddies! We're excited to have you on board.</p>
                
                <p>To complete your registration and start using all the features, please verify your email address by clicking the button below:</p>
                
                <div style="text-align: center;">
                    <a href="{verification_url}" class="button">Verify Email Address</a>
                </div>
                
                <p>Or copy and paste this link into your browser:</p>
                <p class="link">{verification_url}</p>
                
                <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <strong>What happens next?</strong><br>
                    Once you verify your email, you'll have full access to all features including:
                </p>
                <ul>
                    <li>📊 Mood tracking and analytics</li>
                    <li>✅ Task management</li>
                    <li>⏱️ Focus timer (Pomodoro technique)</li>
                    <li>📅 Calendar integration</li>
                    <li>🤖 AI chatbot companion</li>
                    <li>🧘 Mindfulness exercises</li>
                </ul>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                    If you didn't create an account with Smart Desktop Buddies, please ignore this email.
                </p>
            </div>
            
            <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
                <p>&copy; 2024 Smart Desktop Buddies. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Plain text version
    plain_message = f"""
Welcome to Smart Desktop Buddies, {user.username}!

Thank you for signing up! To complete your registration, please verify your email address by clicking the link below:

{verification_url}

What happens next?
Once you verify your email, you'll have full access to all features including:
- Mood tracking and analytics
- Task management
- Focus timer (Pomodoro technique)
- Calendar integration
- AI chatbot companion
- Mindfulness exercises

If you didn't create an account with Smart Desktop Buddies, please ignore this email.

This is an automated email. Please do not reply to this message.

© 2024 Smart Desktop Buddies. All rights reserved.
    """
    
    try:
        # Check if email configuration is set
        if not getattr(settings, 'EMAIL_HOST_USER', None) or not getattr(settings, 'EMAIL_HOST_PASSWORD', None):
            print("Warning: Email configuration not set. Verification email not sent.")
            print("Please configure EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in your .env file.")
            return False
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', settings.EMAIL_HOST_USER),
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        return True
    except Exception as e:
        import traceback
        print(f"Error sending verification email: {e}")
        print(traceback.format_exc())
        return False


def send_password_reset_email(user, token):
    """
    Send password reset email to user
    
    Args:
        user: User instance
        token: Password reset token
    """
    # Get FRONTEND_URL with fallback
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    reset_url = f"{frontend_url}/reset-password?token={token}&email={user.email}"
    
    # Email subject
    subject = "Reset Your Password - Smart Desktop Buddies"
    
    # Email body (HTML)
    html_message = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .container {{
                background-color: #f9fafb;
                border-radius: 8px;
                padding: 30px;
                border: 1px solid #e5e7eb;
            }}
            .header {{
                text-align: center;
                margin-bottom: 30px;
            }}
            .logo {{
                font-size: 24px;
                font-weight: bold;
                background: linear-gradient(to right, #3b82f6, #8b5cf6);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }}
            .content {{
                background-color: white;
                padding: 25px;
                border-radius: 6px;
                margin-bottom: 20px;
            }}
            .button {{
                display: inline-block;
                padding: 12px 30px;
                background: linear-gradient(to right, #3b82f6, #8b5cf6);
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                margin: 20px 0;
            }}
            .button:hover {{
                opacity: 0.9;
            }}
            .footer {{
                text-align: center;
                color: #6b7280;
                font-size: 12px;
                margin-top: 20px;
            }}
            .link {{
                color: #3b82f6;
                word-break: break-all;
            }}
            .warning {{
                background-color: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">Smart Desktop Buddies</div>
            </div>
            
            <div class="content">
                <h2>Password Reset Request 🔒</h2>
                
                <p>Hello {user.username},</p>
                
                <p>We received a request to reset your password for your Smart Desktop Buddies account.</p>
                
                <p>Click the button below to reset your password:</p>
                
                <div style="text-align: center;">
                    <a href="{reset_url}" class="button">Reset Password</a>
                </div>
                
                <p>Or copy and paste this link into your browser:</p>
                <p class="link">{reset_url}</p>
                
                <div class="warning">
                    <strong>⚠️ Important:</strong>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>This link will expire in 1 hour</li>
                        <li>If you didn't request a password reset, please ignore this email</li>
                        <li>Your password will remain unchanged if you don't click the link</li>
                    </ul>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                    For security reasons, this link can only be used once. If you need to reset your password again, please request a new reset link.
                </p>
            </div>
            
            <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
                <p>&copy; 2024 Smart Desktop Buddies. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Plain text version
    plain_message = f"""
Password Reset Request - Smart Desktop Buddies

Hello {user.username},

We received a request to reset your password for your Smart Desktop Buddies account.

Click the link below to reset your password:

{reset_url}

⚠️ Important:
- This link will expire in 1 hour
- If you didn't request a password reset, please ignore this email
- Your password will remain unchanged if you don't click the link
- For security reasons, this link can only be used once

If you need to reset your password again, please request a new reset link.

This is an automated email. Please do not reply to this message.

© 2024 Smart Desktop Buddies. All rights reserved.
    """
    
    try:
        # Check if email configuration is set
        if not getattr(settings, 'EMAIL_HOST_USER', None) or not getattr(settings, 'EMAIL_HOST_PASSWORD', None):
            print("Warning: Email configuration not set. Password reset email not sent.")
            print("Please configure EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in your .env file.")
            return False
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', settings.EMAIL_HOST_USER),
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        return True
    except Exception as e:
        import traceback
        print(f"Error sending password reset email: {e}")
        print(traceback.format_exc())
        return False
