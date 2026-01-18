# Smart Desktop Buddies

**Your AI-powered companion for better mental health and study productivity**

Smart Desktop Buddies is my final year project for Software Engineering course at University of Malaya. It is a full-stack web application designed to help students and professionals improve their mental health, productivity, and overall well-being. The application combines mood tracking, task management, focus timers, calendar integration, and an AI chatbot companion to create a productivity and wellness solution.

## 🛠️ Tech Stack

### Backend
- **Django 5.2** - Python web framework
- **Django REST Framework 3.15.2** - RESTful API development
- **djangorestframework-simplejwt 5.3.1** - JWT authentication
- **PostgreSQL** - Database (SQLite for development)
- **Google Calendar API** - Calendar integration
- **Google Gemini API** - AI chatbot functionality
- **Cryptography** - Secure token encryption

### Frontend
- **Next.js 15.2.4** - React framework
- **React 18.2.0** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **Recharts** - Data visualization
- **Next Themes** - Dark mode support

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.8+** - [Download Python](https://www.python.org/downloads/)
- **Node.js 18+** and **npm** - [Download Node.js](https://nodejs.org/)
- **PostgreSQL 12+** (optional, SQLite used by default) - [Download PostgreSQL](https://www.postgresql.org/download/)
- **Git** - [Download Git](https://git-scm.com/downloads)

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd smart-desktop-buddies
```

### Step 2: Backend Setup

#### 2.1 Navigate to Backend Directory

```bash
cd backend
```

#### 2.2 Create Virtual Environment

**Windows (PowerShell):**
```bash
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**
```bash
python -m venv venv
venv\Scripts\activate.bat
```

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

#### 2.3 Install Dependencies

```bash
pip install -r requirements.txt
```

#### 2.4 Navigate to Django Project

```bash
cd core
```

#### 2.5 Set Up Environment Variables

Create a `.env` file in the `backend/core/` directory:

```bash
# Windows
copy .env.example .env

# macOS/Linux
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
# Django Settings
# Generate using: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
SECRET_KEY=your-generated-secret-key-here
DEBUG=True

# Google Calendar API (Optional - for calendar features)
# Get from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/calendar/google/callback/

# Encryption Key (Optional - for calendar OAuth tokens)
# Generate using: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=your-generated-encryption-key-here

# Gemini API (Optional - for AI chatbot)
# Get from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your-gemini-api-key-here

# Email Configuration (Required for email verification and password reset)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=your-email@gmail.com
FRONTEND_URL=http://localhost:3000
```

**Generating Keys:**

```bash
# Django Secret Key
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Encryption Key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Gmail App Password Setup:**
1. Enable 2-factor authentication on your Gmail account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Create an app password for "Mail"
4. Use the generated 16-character password as `EMAIL_HOST_PASSWORD`

#### 2.6 Run Database Migrations

```bash
python manage.py migrate
```

#### 2.7 Create Superuser (Optional)

```bash
python manage.py createsuperuser
```

Follow the prompts to create an admin account.

#### 2.8 Start Backend Server

```bash
python manage.py runserver
```

The backend API will be available at: **http://localhost:8000**

- API Base URL: `http://localhost:8000/api`
- Admin Panel: `http://localhost:8000/admin`

### Step 3: Frontend Setup

#### 3.1 Open a New Terminal Window

Keep the backend server running in the first terminal.

#### 3.2 Navigate to Frontend Directory

```bash
cd frontend
```

#### 3.3 Install Dependencies

```bash
npm install
```

or if you prefer pnpm:

```bash
pnpm install
```

#### 3.4 Start Development Server

```bash
npm run dev
```

or with pnpm:

```bash
pnpm dev
```

The frontend will be available at: **http://localhost:3000**

### Step 4: Verify Installation

1. **Backend Check**
   - Visit `http://localhost:8000/admin` - Should show Django admin login
   - Visit `http://localhost:8000/api/auth/register/` - Should show API endpoint

2. **Frontend Check**
   - Visit `http://localhost:3000` - Should show the login/registration page

3. **Test Registration**
   - Create a new account
   - Check your email for verification link
   - Verify email and log in

## 📖 Usage Guide

### Running the Application

**Terminal 1 - Backend:**
```bash
cd backend
.\venv\Scripts\Activate.ps1  # Windows PowerShell
cd core
python manage.py runserver
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Features

- **Dashboard**: Overview of tasks, mood, calendar events, and productivity metrics
- **Mood Tracker**: Log daily moods and view analytics
- **Tasks**: Create, edit, and manage tasks with due dates and priorities
- **Focus Timer**: Use Pomodoro technique (25-minute focus sessions)
- **Calendar**: Connect Google Calendar to view and sync events
- **Chatbot**: Interact with AI companion for support and motivation
- **Analytics**: View productivity and mood trends over time
- **Settings**: Manage profile, preferences, and calendar connections

## 🔧 Configuration

### Optional Features Setup

#### Google Calendar Integration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `http://localhost:8000/api/calendar/google/callback/`
6. Copy Client ID and Secret to `.env` file
7. Generate encryption key and add to `.env`

#### Gemini AI Chatbot

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add to `.env` as `GEMINI_API_KEY`

## 🐛 Troubleshooting

### Backend Issues

**Database Connection Error**
- Ensure PostgreSQL is running (if using PostgreSQL)
- Check database credentials in `.env` file
- SQLite is used by default - no setup required

**Migration Errors**
```bash
python manage.py migrate --run-syncdb
```

**Environment Variables Not Loading**
- Ensure `.env` file exists in `backend/core/` directory
- Check variable names match exactly (no spaces around `=`)
- Restart Django server after editing `.env`
- Verify `python-dotenv` is installed: `pip install python-dotenv`

**Port Already in Use**
```bash
python manage.py runserver 8001
# Update frontend/lib/api.ts: const API_URL = 'http://localhost:8001/api';
```

### Frontend Issues

**Module Not Found**
```bash
rm -rf node_modules package-lock.json
npm install
```

**API Connection Failed**
- Ensure backend server is running on port 8000
- Check CORS settings in `backend/core/core/settings.py`
- Verify API URL in `frontend/lib/api.ts`

**Email Not Sending**
- Verify email configuration in `.env` file
- Check Gmail app password is correct
- Ensure 2-factor authentication is enabled on Gmail account

## 🔒 Security Notes

- **Never commit `.env` file** - It contains sensitive credentials
- **Use `.env.example`** as a template for required variables
- **Generate new keys** for production deployment
- **Set `DEBUG=False`** in production
- **Use strong passwords** for database and admin accounts

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - User login
- `POST /api/auth/token/refresh/` - Refresh JWT token
- `GET /api/auth/profile/` - Get user profile
- `PATCH /api/auth/profile/` - Update user profile
- `POST /api/auth/change-password/` - Change password
- `GET /api/auth/verify-email/` - Verify email address
- `POST /api/auth/forgot-password/` - Request password reset
- `POST /api/auth/reset-password/` - Reset password

### Other Endpoints
- `/api/mood-log/` - Mood tracking
- `/api/tasks/` - Task management
- `/api/screen-activity/` - Activity tracking
- `/api/motivation/` - Goals and motivation
- `/api/calendar/` - Calendar integration
- `/api/chatbot/` - AI chatbot

## 📄 License

This is a final year project (FYP) for academic purposes.

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!





