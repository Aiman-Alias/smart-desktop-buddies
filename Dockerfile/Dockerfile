# Repository link: https://github.com/Aiman-Alias/smart-desktop-buddies/tree/docker-assignment
# Base image with Python 3.11
FROM python:3.11-slim

# Set my working directory inside container
WORKDIR /app

# Copy requirements file first (for better caching later on i think)
COPY backend/requirements.txt /app/requirements.txt

# to install Python dependencies (using pip)
RUN pip install --no-cache-dir -r requirements.txt

# this to copy entire backend directory
COPY backend/ /app/backend/

# Set working directory to Django project root (where manage.py is)
WORKDIR /app/backend/core

# Expose port 8000 (i use this because its the Django default port)
EXPOSE 8000

# Set environment variables (using defaults if not provided because i don't want to change the default values)
ENV SECRET_KEY=django-insecure-docker-secret-key-for-testing
ENV DEBUG=True

# Run database migrations and start server (i use this because its the command i used to start the server)
CMD python manage.py migrate && python manage.py runserver 0.0.0.0:8000