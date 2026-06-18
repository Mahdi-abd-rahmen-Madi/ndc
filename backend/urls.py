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
import os
from django.http import HttpResponse, Http404

def serve_media_custom(request, path):
    full_path = os.path.join(settings.MEDIA_ROOT, path)
    if not os.path.exists(full_path) or os.path.isdir(full_path):
        raise Http404("File not found")
        
    content_type = 'application/octet-stream'
    if path.lower().endswith('.pdf'):
        content_type = 'application/pdf'
    elif path.lower().endswith('.docx'):
        content_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    elif path.lower().endswith('.doc'):
        content_type = 'application/msword'
        
    with open(full_path, 'rb') as f:
        content = f.read()
        
    response = HttpResponse(content, content_type=content_type)
    response['X-Frame-Options'] = 'ALLOWALL'
    response['Content-Disposition'] = f'inline; filename="{os.path.basename(full_path)}"'
    return response

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('api/geodata/', include('geodata.urls')),
    path('media/<path:path>', serve_media_custom),
]
