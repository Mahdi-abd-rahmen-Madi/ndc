"""
URL configuration for ndc project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.http import FileResponse, Http404
from django.views.decorators.clickjacking import xframe_options_exempt
import mimetypes
import os

from utils.path_security import safe_resolve_under


@xframe_options_exempt
def serve_media_custom(request, path):
    full_path = safe_resolve_under(settings.MEDIA_ROOT, path)
    if not full_path or not os.path.isfile(full_path):
        raise Http404("File not found")

    content_type, _ = mimetypes.guess_type(full_path)
    content_type = content_type or 'application/octet-stream'

    response = FileResponse(open(full_path, 'rb'), content_type=content_type)
    allowed_origins = " ".join(getattr(settings, 'CORS_ALLOWED_ORIGINS', []))
    response['Content-Security-Policy'] = f"frame-ancestors 'self' {allowed_origins}".strip()
    response['Content-Disposition'] = f'inline; filename="{os.path.basename(full_path)}"'
    return response


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('api/geodata/', include('geodata.urls')),
    path('media/<path:path>', serve_media_custom),
]

if settings.DEBUG:
    from geodata.views import test_catalogue_equipment_view
    urlpatterns.append(path('test-catalogue/', test_catalogue_equipment_view, name='test-catalogue'))
