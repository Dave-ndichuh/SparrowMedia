"""
Sparrow Media OS URL Configuration
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from django.http import JsonResponse

def root_status_view(request):
    return JsonResponse({
        "status": "online",
        "service": "Sparrow Media OS Backend",
        "version": "0.1.0",
        "message": "Backend API is active and ready.",
        "endpoints": {
            "health": "/health/",
            "assets": "/api/assets/",
            "agents": "/api/agents/",
            "admin": "/admin/",
        }
    })

urlpatterns = [
    path('', root_status_view, name='root-status'),
    path('health/', root_status_view, name='health-check'),
    path('admin/', admin.site.urls),
    path('api/assets/', include('assets.urls')),
    path('api/agents/', include('agents.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
