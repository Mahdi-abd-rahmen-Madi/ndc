from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

import hashlib
import json
from .models import UserProfile, CalculationJob
from .serializers import UserProfileSerializer, CalculationJobSerializer
from .aps_service import get_aps_token


class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all().select_related('user')
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['department', 'role']
    search_fields = ['user__username', 'user__email', 'department', 'role']
    ordering_fields = ['user__username', 'department', 'role', 'created_at', 'updated_at']
    ordering = ['user__username']

    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        if request.method == 'GET':
            try:
                profile = request.user.profile
                serializer = self.get_serializer(profile)
                return Response(serializer.data)
            except UserProfile.DoesNotExist:
                return Response({'detail': 'Profile not found'}, status=404)
        
        elif request.method == 'PATCH':
            try:
                profile = request.user.profile
                serializer = self.get_serializer(profile, data=request.data, partial=True)
                if serializer.is_valid():
                    serializer.save()
                    return Response(serializer.data)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            except UserProfile.DoesNotExist:
                return Response({'detail': 'Profile not found'}, status=404)


class HomeView(APIView):
    """
    Simple home view to handle root URL requests
    """
    def get(self, request):
        return Response({
            'message': 'Welcome to NDC API',
            'endpoints': {
                'user-profiles': '/api/user-profiles/',
                'calculations': '/api/calculations/',
                'aps-token': '/api/aps/token/',
                'admin': '/admin/'
            }
        })


class APSTokenView(APIView):
    """
    Returns a 2-legged APS access token.
    """
    permission_classes = [permissions.AllowAny] # Change to IsAuthenticated if needed in production

    def get(self, request):
        try:
            token_info = get_aps_token()
            return Response(token_info, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CalculationJobViewSet(viewsets.ModelViewSet):
    """
    Handles calculation requests and acts as a catalog/cache for previous results.
    """
    queryset = CalculationJob.objects.all()
    serializer_class = CalculationJobSerializer
    permission_classes = [permissions.AllowAny] # Adjust as per your auth requirements

    def get_queryset(self):
        # Users can only see their own jobs unless admin/windows server
        # For simplicity now, let's allow all or filter by user if authenticated
        return CalculationJob.objects.all()

    def create(self, request, *args, **kwargs):
        input_data = request.data
        
        # Hash the input data to identify identical calculation requests
        # Sort keys to ensure consistent hashing
        data_string = json.dumps(input_data, sort_keys=True)
        input_hash = hashlib.sha256(data_string.encode('utf-8')).hexdigest()

        # Check if a completed job with the same hash exists
        existing_job = CalculationJob.objects.filter(input_hash=input_hash, status='COMPLETED').first()
        if existing_job:
            serializer = self.get_serializer(existing_job)
            return Response({
                'message': 'Found cached result in catalogue.',
                'cached': True,
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        # Create a new job
        # Set user if authenticated
        user = request.user if request.user.is_authenticated else None
        
        job = CalculationJob.objects.create(
            user=user,
            input_hash=input_hash,
            input_data=input_data,
            status='PENDING'
        )
        
        serializer = self.get_serializer(job)
        return Response({
            'message': 'New calculation job queued.',
            'cached': False,
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """
        Endpoint for Windows Server to poll for pending jobs.
        """
        jobs = CalculationJob.objects.filter(status='PENDING')
        serializer = self.get_serializer(jobs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        Endpoint for Windows Server to submit calculation results.
        """
        job = self.get_object()
        
        if job.status == 'COMPLETED':
            return Response({'error': 'Job already completed.'}, status=status.HTTP_400_BAD_REQUEST)
            
        result_data = request.data.get('result_data')
        error_message = request.data.get('error_message')
        job_status = request.data.get('status', 'COMPLETED')
        
        job.status = job_status
        job.result_data = result_data
        job.error_message = error_message
        job.save()
        
        serializer = self.get_serializer(job)
        return Response(serializer.data, status=status.HTTP_200_OK)
