#!/bin/sh
set -e

echo "Running database migrations..."
python manage.py migrate --noinput || true

PORT="${PORT:-8000}"
echo "Starting Gunicorn on 0.0.0.0:${PORT}..."
exec gunicorn sparrow_backend.wsgi:application --bind "0.0.0.0:${PORT}" --workers 3
