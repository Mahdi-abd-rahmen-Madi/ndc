from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'user-profiles', views.UserProfileViewSet)
router.register(r'calculations', views.CalculationJobViewSet, basename='calculations')

urlpatterns = [
    path('', views.HomeView.as_view(), name='home'),
    path('', include(router.urls)),
    path('aps/token/', views.APSTokenView.as_view(), name='aps-token'),
    path('upload-photo/', views.PhotoUploadView.as_view(), name='upload-photo'),
    path('worker/control/', views.WorkerControlView.as_view(), name='worker-control'),
]
