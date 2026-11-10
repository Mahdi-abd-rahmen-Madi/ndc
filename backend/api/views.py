from rest_framework import viewsets, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from rest_framework.authtoken.models import Token
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

import hashlib
import json
import threading
from .models import UserProfile, CalculationJob, GeneratedSiteNdc
from .serializers import (
    UserProfileSerializer, CalculationJobSerializer, CalculationPayloadSerializer,
    GeneratedSiteNdcSerializer
)
from .aps_service import get_aps_token
from .tasks import send_job_to_worker
from utils.ndc_hash import detect_calculation_type, compute_ndc_hash
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

    @action(detail=False, methods=['get'])
    def calculations_history(self, request):
        """
        Returns the history of generated Site Notes de Calcul for the current authenticated user.
        """
        history = GeneratedSiteNdc.objects.filter(user=request.user).order_by('-created_at')
        serializer = GeneratedSiteNdcSerializer(history, many=True)
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
        
        input_data = dict(payload_serializer.validated_data)
        force_recalculate = bool(input_data.get("force_recalculate") or request.data.get("force_recalculate"))

        # Quota check if authenticated user has a subscription
        user = request.user if request.user.is_authenticated else None
        if user and hasattr(user, 'subscription'):
            if user.subscription.used_quota >= user.subscription.monthly_quota:
                return Response(
                    {"error": "Monthly calculation quota exceeded. Please upgrade your plan."},
                    status=status.HTTP_402_PAYMENT_REQUIRED
                )
            client_id = f"client_{user.id}"
        else:
            client_id = input_data.get("client_id") or "default_client"
        input_data['client_id'] = client_id

        # 1. Detect type and compute unique deterministic NDC hash
        calc_type = detect_calculation_type(input_data)
        ndc_hash = compute_ndc_hash(calc_type, input_data)

        # 2. Check Database Cache for Instant Hit
        if not force_recalculate:
            cached_job = CalculationJob.objects.filter(
                ndc_hash=ndc_hash,
                status="COMPLETED"
            ).order_by("-id").first()

            if cached_job and (cached_job.compiled_pdf or cached_job.result_data):
                # Create a cloned record or return the cached calculation directly
                new_job = CalculationJob.objects.create(
                    user=user,
                    client_id=client_id,
                    calculation_type=calc_type,
                    ndc_hash=ndc_hash,
                    input_hash=ndc_hash,
                    is_cached=True,
                    status="COMPLETED",
                    input_data=input_data,
                    result_data=cached_job.result_data,
                    screenshot=cached_job.screenshot,
                    verification_screenshot=cached_job.verification_screenshot,
                    note_de_calcul=cached_job.note_de_calcul,
                    note_mat=cached_job.note_mat,
                    note_plot=cached_job.note_plot,
                    assemblage_note=cached_job.assemblage_note,
                    reactions_file=cached_job.reactions_file,
                    compiled_docx=cached_job.compiled_docx,
                    compiled_pdf=cached_job.compiled_pdf,
                )
                serializer = self.get_serializer(new_job)
                return Response({
                    "message": "Instant Cache Hit! NDC loaded without recalculation.",
                    "calculation_id": new_job.id,
                    "cached": True,
                    "ndc_hash": ndc_hash,
                    "status": "COMPLETED",
                    "data": serializer.data,
                    "pdf_url": new_job.compiled_pdf.url if new_job.compiled_pdf else None,
                    "result_data": new_job.result_data,
                }, status=status.HTTP_200_OK)

        # 3. Create Pending Job
        job = CalculationJob.objects.create(
            user=user,
            client_id=client_id,
            calculation_type=calc_type,
            ndc_hash=ndc_hash,
            input_hash=ndc_hash,
            is_cached=False,
            status="PENDING",
            input_data=input_data
        )

        # 4. Dispatch to Unified Robot Worker in a background thread
        threading.Thread(
            target=send_job_to_worker,
            args=(job.id,),
            daemon=True
        ).start()

        serializer = self.get_serializer(job)
        return Response({
            "message": f"{calc_type.upper()} Calculation enqueued successfully.",
            "calculation_id": job.id,
            "ndc_hash": ndc_hash,
            "cached": False,
            "status": "PENDING",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser, JSONParser])
    def complete(self, request, pk=None):
        """
        Endpoint for Unified Robot Worker to submit calculation results and artifacts.
        Worker calls POST /api/calculations/<id>/complete/
        """
        job = get_object_or_404(CalculationJob, pk=pk)

        # Parse result_data
        raw_result_data = request.data.get('result_data') or request.POST.get('result_data')
        if isinstance(raw_result_data, str) and raw_result_data.strip():
            try:
                result_data = json.loads(raw_result_data)
            except Exception:
                result_data = {}
        elif isinstance(raw_result_data, dict):
            result_data = raw_result_data
        else:
            result_data = {}

        error_message = request.data.get('error_message') or request.POST.get('error_message', '')
        job_status = request.data.get('status') or request.POST.get('status', 'COMPLETED')

        # Store ndc_hash and calculation_type reported by worker if present
        if result_data and "ndc_hash" in result_data:
            job.ndc_hash = result_data["ndc_hash"]
        if result_data and "calculation_type" in result_data:
            job.calculation_type = result_data["calculation_type"]

        job.status = job_status
        job.result_data = result_data
        job.error_message = error_message

        # Save uploaded artifact files from worker (Base Antenna & Dedicated RRH)
        files = request.FILES
        
        # 1. Base Antenna Files
        if 'screenshot' in files:
            job.screenshot = files['screenshot']
        if 'verification_screenshot' in files:
            job.verification_screenshot = files['verification_screenshot']
        if 'note_de_calcul' in files:
            job.note_de_calcul = files['note_de_calcul']
        if 'assemblage_note' in files:
            job.assemblage_note = files['assemblage_note']
        if 'reactions_file' in files:
            job.reactions_file = files['reactions_file']

        # 2. RRH Support Files (Accepts both primary and alias keys)
        rrh_ndc = files.get("note_de_calcul_rrh") or files.get("rrh_note_de_calcul")
        if rrh_ndc:
            job.note_de_calcul_rrh = rrh_ndc

        note_mat = files.get("note_mat") or files.get("rrh_note_mat")
        if note_mat:
            job.note_mat = note_mat

        note_plot = files.get("note_plot") or files.get("rrh_note_plot")
        if note_plot:
            job.note_plot = note_plot

        if 'rrh_assemblage_note' in files:
            job.rrh_assemblage_note = files['rrh_assemblage_note']

        if 'rrh_verification_screenshot' in files:
            job.rrh_verification_screenshot = files['rrh_verification_screenshot']

        charges_img = files.get("rrh_tableau_charges") or files.get("loads_table")
        if charges_img:
            job.rrh_tableau_charges = charges_img

        if 'rrh_reactions_file' in files:
            job.rrh_reactions_file = files['rrh_reactions_file']

        if 'rrh_screenshot' in files:
            job.rrh_screenshot = files['rrh_screenshot']

        # Manage user quota if completed
        if job_status == 'COMPLETED':
            if job.user and hasattr(job.user, 'subscription'):
                job.user.subscription.used_quota += job.credits_consumed
                job.user.subscription.save()

        job.save()

        # Broadcast completion to WebSocket listeners
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"calc_{job.id}",
                    {
                        "type": "calc_progress",
                        "data": {
                            "job_id": job.id,
                            "stage": "COMPLETED" if job_status == "COMPLETED" else "FAILED",
                            "percent": 100 if job_status == "COMPLETED" else 0,
                            "message": "Calcul terminé avec succès" if job_status == "COMPLETED" else f"Échec: {error_message}",
                            "status": job_status,
                            "is_completed": job_status == "COMPLETED"
                        }
                    }
                )
        except Exception as ws_err:
            print(f"WebSocket broadcast warning: {ws_err}")

        # Trigger backend document compilation (DOCX / PDF)
        if job_status == 'COMPLETED':
            try:
                from .services import assemble_ndc_document
                assemble_ndc_document(job.id)
            except Exception as e:
                print(f"Document compilation warning for Job {job.id}: {e}")

        serializer = self.get_serializer(job)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser, JSONParser])
    def progress(self, request, pk=None):
        """
        Called by Windows Robot Worker during execution to push live milestones.
        POST /api/calculations/<id>/progress/
        Payload: { "stage": "SOLVING", "percent": 75, "message": "Calcul en cours...", "details": {...} }
        """
        job = get_object_or_404(CalculationJob, pk=pk)

        stage = request.data.get('stage', 'RUNNING')
        try:
            percent = int(request.data.get('percent', 0))
        except (ValueError, TypeError):
            percent = 0

        message = request.data.get('message', '')
        details = request.data.get('details', {})

        # Ensure status reflects active calculation
        if job.status == 'PENDING':
            job.status = 'RUNNING'

        if not isinstance(job.result_data, dict):
            job.result_data = {}

        job.result_data['progress'] = {
            'stage': stage,
            'percent': percent,
            'message': message,
            'details': details
        }
        job.save(update_fields=['status', 'result_data', 'updated_at'])

        # Broadcast event to WebSocket channel group
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"calc_{job.id}",
                    {
                        "type": "calc_progress",
                        "data": {
                            "job_id": job.id,
                            "stage": stage,
                            "percent": percent,
                            "message": message,
                            "details": details,
                            "status": job.status,
                            "is_completed": False
                        }
                    }
                )
        except Exception as ws_err:
            print(f"WebSocket broadcast error: {ws_err}")

        return Response({"status": "ok", "job_id": job.id, "stage": stage, "percent": percent})

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

        from geodata.ndc_generator import generate_ndc_pdf_task
        try:
            pdf_url = generate_ndc_pdf_task(job.id, photo_url)
            return Response({'message': 'PDF generated successfully', 'ndc_pdf_url': pdf_url}, status=status.HTTP_200_OK)
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
                'code_site': request.GET.get('code_site') or request.GET.get('ref_site') or '',
                'ref_site': request.GET.get('code_site') or request.GET.get('ref_site') or '',
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
                    
                preview_data = dict(request.data)
                
                import json
                for key in ['site', 'environment', 'structure', 'antenna_4g', 'antenna_5g', 'fh_equipment', 'rrh_equipment', 'rru_equipment', 'td_equipment', 'gps', 'boitier_lovage', 'coffrets_fibre', 'baie', 'cab', 'atelier_energie']:
                    val = preview_data.get(key)
                    if isinstance(val, str):
                        try:
                            preview_data[key] = json.loads(val)
                        except json.JSONDecodeError:
                            pass

                operator_name = (preview_data.get('site', {}).get('operator') or request.data.get('operator') or '').lower().strip()
                if (operator_name == 'bouygues' or operator_name == 'orange') and 'td_equipment' in preview_data and isinstance(preview_data['td_equipment'], dict):
                    preview_data['td_equipment']['enabled'] = False

                code_val = request.data.get('code_site') or request.data.get('ref_site') or ''
                if 'site' not in preview_data or not isinstance(preview_data['site'], dict):
                    preview_data['site'] = {
                        'name': request.data.get('site_name', ''),
                        'code_site': code_val,
                        'ref_site': code_val,
                        'client': request.data.get('client_name', ''),
                        'address': request.data.get('address', '')
                    }
                else:
                    if not preview_data['site'].get('code_site') and code_val:
                        preview_data['site']['code_site'] = code_val
                        preview_data['site']['ref_site'] = code_val
                if 'environment' not in preview_data or not isinstance(preview_data['environment'], dict):
                    preview_data['environment'] = {
                        'etancheite': request.data.get('etancheite'),
                        'dalle_thickness_m': request.data.get('dalle_thickness_m')
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
                            from pypdf import PdfReader
                            reader = PdfReader(cat_abs_path)
                            for i, page in enumerate(reader.pages):
                                if i in [0, 1]: # Skip pages 1-2 of catalogue (Description/Equipment table + Wind hypotheses) - already generated by template
                                    continue
                                merger.add_page(page)
                
                has_any_eq = False
                for eq_key in ['fh_equipment', 'rrh_equipment', 'rru_equipment', 'td_equipment', 'gps', 'boitier_lovage', 'coffrets_fibre']:
                    eq = preview_data.get(eq_key, {})
                    if isinstance(eq, dict) and eq.get('enabled'):
                        if eq_key == 'td_equipment' and (operator_name == 'bouygues' or operator_name == 'orange'):
                            continue
                        has_any_eq = True
                        break
                        
                if has_any_eq:
                    from geodata.ndc_generator import generate_auxiliary_pdfs
                    class DummyJob:
                        input_data = preview_data
                        id = 'fast'
                    aux_paths = generate_auxiliary_pdfs(DummyJob(), start_page=len(merger.pages) + 1)
                    for aux in aux_paths:
                        if os.path.exists(aux):
                            merger.append(aux)
                
                output_filename = f"SITE_NDC_FAST_{uuid.uuid4().hex[:8]}.pdf"
                outdir = os.path.join(settings.MEDIA_ROOT, 'uploads')
                os.makedirs(outdir, exist_ok=True)
                merged_pdf_path = os.path.join(outdir, output_filename)
                merger.write(merged_pdf_path)
                merger.close()
                
                final_pdf_url = settings.MEDIA_URL + f"uploads/{output_filename}"

                # Persist to history if user is authenticated
                if request.user and request.user.is_authenticated:
                    GeneratedSiteNdc.objects.create(
                        user=request.user,
                        site_name=request.data.get('site_name', '') or preview_data.get('site', {}).get('name', ''),
                        code_site=request.data.get('code_site', '') or request.data.get('ref_site', '') or preview_data.get('site', {}).get('code_site', ''),
                        client_name=request.data.get('client_name', '') or preview_data.get('site', {}).get('client', ''),
                        address=request.data.get('address', '') or preview_data.get('site', {}).get('address', ''),
                        operator=request.data.get('operator', '') or preview_data.get('site', {}).get('operator', ''),
                        pdf_url=final_pdf_url
                    )

                return Response({'ndc_pdf_url': final_pdf_url}, status=status.HTTP_200_OK)

            job_ids = request.data.get('job_ids', [])
    
            if not job_ids:
                return Response({'error': 'No job IDs provided'}, status=status.HTTP_400_BAD_REQUEST)
    
            temp_pdfs = []
            merger = PdfWriter()
            total_pages = 0

            for i, job_id in enumerate(job_ids):
                job = CalculationJob.objects.get(id=job_id)
                # First sector gets the cover page and hypotheses. Subsequent ones don't.
                is_subsequent = (i > 0)
                
                job_photo_url = photo_url
                if not job_photo_url and job.input_data and job.input_data.get('site_image_url'):
                    job_photo_url = job.input_data.get('site_image_url')

                if isinstance(job.input_data, dict):
                    if 'site' not in job.input_data or not isinstance(job.input_data['site'], dict):
                        job.input_data['site'] = {}
                    if not job.input_data['site'].get('code_site') and (request.data.get('code_site') or request.data.get('ref_site')):
                        c_val = request.data.get('code_site') or request.data.get('ref_site')
                        job.input_data['site']['code_site'] = c_val
                        job.input_data['site']['ref_site'] = c_val
                    if not job.input_data['site'].get('name') and request.data.get('site_name'):
                        job.input_data['site']['name'] = request.data.get('site_name')
                    
                pdf_url = generate_ndc_pdf(job, job_photo_url, is_subsequent_sector=is_subsequent, start_page=total_pages + 1)
                
                # Convert relative URL back to absolute file path
                if pdf_url.startswith(settings.MEDIA_URL):
                    rel_path = pdf_url[len(settings.MEDIA_URL):]
                    abs_path = os.path.join(settings.MEDIA_ROOT, rel_path)
                    if os.path.exists(abs_path):
                        temp_pdfs.append(abs_path)
                        merger.append(abs_path)
                        from pypdf import PdfReader
                        reader = PdfReader(abs_path)
                        total_pages += len(reader.pages)
    
            # Generate and append auxiliary equipment PDFs if enabled
            if job_ids:
                first_job = CalculationJob.objects.get(id=job_ids[0])
                aux_pdf_paths = generate_auxiliary_pdfs(first_job, start_page=total_pages + 1)
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

            # Persist to history if user is authenticated
            if request.user and request.user.is_authenticated:
                GeneratedSiteNdc.objects.create(
                    user=request.user,
                    site_name=request.data.get('site_name', ''),
                    code_site=request.data.get('code_site', '') or request.data.get('ref_site', ''),
                    client_name=request.data.get('client_name', ''),
                    address=request.data.get('address', ''),
                    operator=request.data.get('operator', ''),
                    pdf_url=final_pdf_url
                )

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

from django.http import HttpResponse, HttpResponseForbidden

def download_note_de_calcul(request, client_id, filename):
    # 1. Verify user owns this client_id
    if not request.user.is_authenticated or f"client_{request.user.id}" != client_id:
        return HttpResponseForbidden("Unauthorized")
        
    # 2. Instruct Caddy to serve the file
    response = HttpResponse()
    # The header tells Caddy to fetch the file from the local root
    response['X-Accel-Redirect'] = f"/{client_id}/{filename}"
    response['Content-Type'] = "application/rtf"
    return response
