"""
ASGI config for Sparrow Media OS project.
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sparrow_backend.settings')

application = get_asgi_application()
