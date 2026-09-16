from rest_framework import viewsets, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

import hashlib
import json
from .models import UserProfile, CalculationJob
from .serializers import UserProfileSerializer, CalculationJobSerializer, CalculationPayloadSerializer
from .aps_service import get_aps_token
from django.core.files.storage import FileSystemStorage
from django.conf import settings
import os
import uuid


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
            profile, _ = UserProfile.objects.get_or_create(user=request.user)
            serializer = self.get_serializer(profile)
            return Response(serializer.data)

        elif request.method == 'PATCH':
            profile, _ = UserProfile.objects.get_or_create(user=request.user)
            serializer = self.get_serializer(profile, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_logo(self, request):
        profile, created = UserProfile.objects.get_or_create(user=request.user)
            
        file_obj = request.data.get('file')
        if not file_obj:
            file_keys = list(request.FILES.keys())
            data_keys = list(request.data.keys())
            return Response({'error': f'No file provided. FILES keys: {file_keys}, data keys: {data_keys}'}, status=status.HTTP_400_BAD_REQUEST)
            
        import uuid
        ext = file_obj.name.split('.')[-1] if '.' in file_obj.name else 'png'
        file_obj.name = f"{uuid.uuid4().hex}.{ext}"
            
        profile.client_logo = file_obj
        profile.save()
        
        serializer = self.get_serializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)


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

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        user_obj = User.objects.filter(email=email).first() or User.objects.filter(username=email).first()
        user = None
        if user_obj:
            user = authenticate(username=user_obj.username, password=password)
            
        if user:
            token, _ = Token.objects.get_or_create(user=user)
            return Response({'token': token.key, 'email': user.username, 'is_admin': user.is_staff})
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not email or not password:
            return Response({'error': 'Email and password required'}, status=status.HTTP_400_BAD_REQUEST)
            
        if User.objects.filter(username=email).exists():
            return Response({'error': 'User already exists'}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.create_user(username=email, email=email, password=password)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'email': user.username, 'is_admin': user.is_staff}, status=status.HTTP_201_CREATED)


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


class PhotoUploadView(APIView):
    """
    Endpoint for uploading a photo before starting a calculation.
    Returns the temporary photo URL.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        photo = request.FILES.get('photo')
        if not photo:
            return Response({'error': 'No photo provided'}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure media/uploads directory exists
        upload_dir = os.path.join(settings.MEDIA_ROOT, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)

        fs = FileSystemStorage(location=upload_dir, base_url=settings.MEDIA_URL + 'uploads/')
        filename = fs.save(f"{uuid.uuid4()}_{photo.name}", photo)
        photo_url = fs.url(filename)

        return Response({'photo_url': photo_url}, status=status.HTTP_201_CREATED)


class CalculationJobViewSet(viewsets.ModelViewSet):
    """
    Handles calculation requests and acts as a catalog/cache for previous results.
    """
    queryset = CalculationJob.objects.select_related('user').all()
    serializer_class = CalculationJobSerializer
    permission_classes = [permissions.AllowAny] # Adjust as per your auth requirements

    def get_queryset(self):
        # Return only the current user's jobs if authenticated
        if self.request.user.is_authenticated:
            return CalculationJob.objects.filter(user=self.request.user)
        return CalculationJob.objects.none()

    def create(self, request, *args, **kwargs):
        payload_serializer = CalculationPayloadSerializer(data=request.data)
        if not payload_serializer.is_valid():
            return Response(
                {"error": "Invalid payload schema", "details": payload_serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        input_data = payload_serializer.validated_data
        
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
        
        # Attach site_image_url if provided
        site_image_url = input_data.get('site_image_url', '')
        
        job = CalculationJob.objects.create(
            user=user,
            input_hash=input_hash,
            input_data=input_data,
            status='PENDING'
        )
        
        # Dispatch the job to the FastAPI worker asynchronously
        from django_q.tasks import async_task
        async_task('api.tasks.send_job_to_worker', job.id)
        
        serializer = self.get_serializer(job)
        return Response({
            'message': 'New calculation job queued.',
            'cached': False,
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
    # 'pending' endpoint has been completely removed in favor of push notifications via FastAPI

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        Endpoint for Windows Server to submit calculation results.
        """
        try:
            job = CalculationJob.objects.get(pk=pk)
        except CalculationJob.DoesNotExist:
            return Response({'error': 'Job not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        if job.status == 'COMPLETED':
            return Response({'error': 'Job already completed.'}, status=status.HTTP_400_BAD_REQUEST)
            
        import json
        
        if 'screenshot' in request.FILES:
            job.screenshot = request.FILES['screenshot']
            
        if 'result_data' in request.POST:
            try:
                result_data = json.loads(request.POST['result_data'])
            except json.JSONDecodeError:
                result_data = request.POST['result_data']
            error_message = request.POST.get('error_message')
            job_status = request.POST.get('status', 'COMPLETED')
        else:
            result_data = request.data.get('result_data')
            error_message = request.data.get('error_message')
            job_status = request.data.get('status', 'COMPLETED')
        
        job.status = job_status
        job.result_data = result_data
        job.error_message = error_message
        job.save()
        
        serializer = self.get_serializer(job)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def generate_pdf(self, request, pk=None):
        """
        Endpoint to generate the Note de Calcul PDF from a completed job.
        Expects {"photo_url": "..."} in the request body.
        """
        job = self.get_object()
        if job.status not in ['COMPLETED', 'PENDING']:
            return Response({'error': 'Job must be COMPLETED or PENDING (inspect mode).'}, status=status.HTTP_400_BAD_REQUEST)

        photo_url = request.data.get('photo_url')
        if not photo_url and job.input_data and job.input_data.get('site_image_url'):
            photo_url = job.input_data.get('site_image_url')
            
        # photo_url is optional, it will be None or empty string if not provided
        photo_url = photo_url or ''

        from django_q.tasks import async_task
        try:
            # We use a task wrapper that handles job ID instead of job object
            task_id = async_task('geodata.ndc_generator.generate_ndc_pdf_task', job.id, photo_url)
            return Response({'message': 'PDF generation queued', 'task_id': task_id}, status=status.HTTP_202_ACCEPTED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get', 'post'])
    def preview_template(self, request):
        """
        Endpoint to generate a preview of the Note de Calcul template with dummy variables.
        """
        from geodata.ndc_generator import generate_ndc_pdf

        # Use photo_url from query parameters (GET) or body (POST)
        # Support both GET and POST requests
        photo_url = request.GET.get('photo_url') or request.data.get('site', {}).get('photo_url') or ''
        
        # When called via POST, request.data has the full JSON payload
        preview_data = request.data if request.data else {
            'site': {
                'name': request.GET.get('site_name') or '',
                'client': request.GET.get('client_name') or '',
                'address': request.GET.get('address') or '',
                'client_logo_url': request.GET.get('client_logo_url') or ''
            }
        }

        try:
            pdf_url = generate_ndc_pdf(None, photo_url, preview_data=preview_data)
            return Response({'ndc_pdf_url': pdf_url}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def generate_site_ndc(self, request):
        """
        Endpoint to generate a combined Site Note de Calcul PDF.
        Expects a list of job IDs in the request body, and optionally a photo_url.
        """
        try:
            from geodata.ndc_generator import generate_ndc_pdf, generate_auxiliary_pdfs
            import os
            from django.conf import settings
            import uuid
            from pypdf import PdfWriter
            from api.models import CalculationJob
    
            fast_track = request.data.get('fast_track', False)
            photo_url = request.data.get('photo_url', '')
            
            if fast_track:
                catalogue_pdf_urls = request.data.get('catalogue_pdf_urls', [])
                if isinstance(catalogue_pdf_urls, str):
                    catalogue_pdf_urls = [catalogue_pdf_urls]
                    
                preview_data = {
                    'site': {
                        'name': request.data.get('site_name', ''),
                        'client': request.data.get('client_name', ''),
                        'address': request.data.get('address', '')
                    },
                    'environment': {
                        'etancheite': request.data.get('etancheite'),
                        'dalle_thickness_m': request.data.get('dalle_thickness_m')
                    }
                }
                
                # Generate cover only
                cover_pdf_url = generate_ndc_pdf(None, photo_url, preview_data=preview_data, is_cover_only=True)
                
                # Merge Cover + Catalogue PDFs
                merger = PdfWriter()
                import urllib.parse
                
                # Cover path
                if cover_pdf_url.startswith(settings.MEDIA_URL):
                    cover_rel_path = cover_pdf_url[len(settings.MEDIA_URL):]
                    cover_abs_path = os.path.join(settings.MEDIA_ROOT, cover_rel_path)
                    if os.path.exists(cover_abs_path):
                        merger.append(cover_abs_path)
                        
                # Catalogue paths
                for cat_url in catalogue_pdf_urls:
                    if cat_url.startswith(settings.MEDIA_URL):
                        cat_rel_path = cat_url[len(settings.MEDIA_URL):]
                        cat_rel_path = urllib.parse.unquote(cat_rel_path)
                        
                        # Ensure we are dealing with a PDF file (convert .docx if necessary)
                        if not cat_rel_path.lower().endswith('.pdf'):
                            from geodata.utils_preview import get_pdf_preview_path
                            pdf_rel_path = get_pdf_preview_path(cat_rel_path)
                            if pdf_rel_path:
                                cat_rel_path = pdf_rel_path
                        
                        cat_abs_path = os.path.join(settings.MEDIA_ROOT, cat_rel_path)
                        if os.path.exists(cat_abs_path):
                            merger.append(cat_abs_path)
                
                output_filename = f"SITE_NDC_FAST_{uuid.uuid4().hex[:8]}.pdf"
                outdir = os.path.join(settings.MEDIA_ROOT, 'uploads')
                os.makedirs(outdir, exist_ok=True)
                merged_pdf_path = os.path.join(outdir, output_filename)
                merger.write(merged_pdf_path)
                merger.close()
                
                final_pdf_url = settings.MEDIA_URL + f"uploads/{output_filename}"
                return Response({'ndc_pdf_url': final_pdf_url}, status=status.HTTP_200_OK)

            job_ids = request.data.get('job_ids', [])
    
            if not job_ids:
                return Response({'error': 'No job IDs provided'}, status=status.HTTP_400_BAD_REQUEST)
    
            temp_pdfs = []
            merger = PdfWriter()

            for i, job_id in enumerate(job_ids):
                job = CalculationJob.objects.get(id=job_id)
                # First sector gets the cover page and hypotheses. Subsequent ones don't.
                is_subsequent = (i > 0)
                
                job_photo_url = photo_url
                if not job_photo_url and job.input_data and job.input_data.get('site_image_url'):
                    job_photo_url = job.input_data.get('site_image_url')
                    
                pdf_url = generate_ndc_pdf(job, job_photo_url, is_subsequent_sector=is_subsequent)
                
                # Convert relative URL back to absolute file path
                if pdf_url.startswith(settings.MEDIA_URL):
                    rel_path = pdf_url[len(settings.MEDIA_URL):]
                    abs_path = os.path.join(settings.MEDIA_ROOT, rel_path)
                    if os.path.exists(abs_path):
                        temp_pdfs.append(abs_path)
                        merger.append(abs_path)
    
            # Generate and append auxiliary equipment PDFs if enabled
            if job_ids:
                first_job = CalculationJob.objects.get(id=job_ids[0])
                aux_pdf_paths = generate_auxiliary_pdfs(first_job)
                for aux_path in aux_pdf_paths:
                    if os.path.exists(aux_path):
                        temp_pdfs.append(aux_path)
                        merger.append(aux_path)
    
            output_filename = f"SITE_NDC_{uuid.uuid4().hex[:8]}.pdf"
            outdir = os.path.join(settings.MEDIA_ROOT, 'uploads')
            os.makedirs(outdir, exist_ok=True)
            
            merged_pdf_path = os.path.join(outdir, output_filename)
            merger.write(merged_pdf_path)
            merger.close()
    
            # Clean up temp pdfs if we want to, but it's fine to leave them since they are in uploads
            
            final_pdf_url = settings.MEDIA_URL + f"uploads/{output_filename}"
            return Response({'ndc_pdf_url': final_pdf_url}, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class WorkerControlView(APIView):
    """
    Endpoint for Windows Server to ping heartbeat and push logs.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.core.cache import cache
        import time
        last_seen = cache.get('worker_last_seen')
        logs = cache.get('worker_logs', [])
        
        is_active = False
        if last_seen and (time.time() - last_seen) < 15:
            is_active = True
            
        return Response({'is_active': is_active, 'logs': logs})

    def post(self, request):
        from django.core.cache import cache
        import time
        message = request.data.get('message')
        if message:
            logs = cache.get('worker_logs', [])
            # Append new log with ISO timestamp
            from datetime import datetime
            timestamp = datetime.now().strftime('%H:%M:%S')
            logs.append({'time': timestamp, 'message': message})
            # Keep only the last 50 logs
            cache.set('worker_logs', logs[-50:], timeout=3600)
            
        cache.set('worker_last_seen', time.time(), timeout=3600)
        return Response({'status': 'ok'})
