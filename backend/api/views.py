from rest_framework import viewsets, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework.authtoken.models import Token
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

import hashlib
import json
import logging
import threading

logger = logging.getLogger(__name__)
from .models import UserProfile, CalculationJob, GeneratedSiteNdc, ClientSubscription
from .permissions import IsRobotWorkerOrAdminPermission
from .serializers import (
    UserProfileSerializer, CalculationJobSerializer, CalculationPayloadSerializer,
    GeneratedSiteNdcSerializer
)
from .aps_service import get_aps_token
from .tasks import enqueue_task
from utils.ndc_hash import detect_calculation_type, compute_ndc_hash
from utils.validators import validate_calculation_mast_heights
from utils.domain_constants import OPERATORS_WITHOUT_TD, normalize_operator, resolve_sans_plot
from utils.path_security import safe_media_path, safe_resolve_under
from django.core.files.storage import FileSystemStorage
from django.conf import settings
import os
import uuid

ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def _broadcast_calc_progress(job_id: int, data: dict):
    """Broadcast a calculation progress/completion event to WebSocket listeners."""
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"calc_{job_id}",
                {"type": "calc_progress", "data": data},
            )
    except Exception as ws_err:
        logger.warning("WebSocket broadcast warning for job %s: %s", job_id, ws_err)


def _validate_image_upload(file_obj):
    ext = os.path.splitext(file_obj.name or '')[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return "Format d'image non supporté (JPG, PNG, WEBP uniquement)."
    content_type = getattr(file_obj, 'content_type', '') or ''
    if content_type and not content_type.startswith('image/'):
        return "Type MIME invalide : une image est attendue."
    if getattr(file_obj, 'size', 0) > MAX_IMAGE_UPLOAD_BYTES:
        return "Fichier trop volumineux (10 Mo maximum)."
    return None


class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all().select_related('user', 'role')
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['department', 'role']
    search_fields = ['user__username', 'user__email', 'department', 'role__name']
    ordering_fields = ['user__username', 'department', 'role', 'created_at', 'updated_at']
    ordering = ['user__username']

    def get_queryset(self):
        qs = UserProfile.objects.select_related('user', 'role')
        if self.request.user.is_staff or self.request.user.is_superuser:
            return qs
        return qs.filter(user=self.request.user)

    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        if request.method == 'GET':
            profile, _ = UserProfile.objects.select_related('user', 'role').get_or_create(user=request.user)
            serializer = self.get_serializer(profile)
            return Response(serializer.data)

        elif request.method == 'PATCH':
            profile, _ = UserProfile.objects.select_related('user', 'role').get_or_create(user=request.user)
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
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        err = _validate_image_upload(file_obj)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
            
        ext = os.path.splitext(file_obj.name or '')[1].lower().lstrip('.') or 'png'
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
        email = (request.data.get('email') or '').strip()
        password = request.data.get('password') or ''
        if not email or not password:
            return Response({'error': 'Email and password required'}, status=status.HTTP_400_BAD_REQUEST)
        
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
        email = (request.data.get('email') or '').strip()
        password = request.data.get('password') or ''
        
        if not email or not password:
            return Response({'error': 'Email and password required'}, status=status.HTTP_400_BAD_REQUEST)
            
        if User.objects.filter(username=email).exists():
            return Response({'error': 'User already exists'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password(password)
        except DjangoValidationError as exc:
            return Response({'error': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
            
        user = User.objects.create_user(username=email, email=email, password=password)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'email': user.username, 'is_admin': user.is_staff}, status=status.HTTP_201_CREATED)


class APSTokenView(APIView):
    """
    Returns a 2-legged APS access token.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            token_info = get_aps_token()
            return Response(token_info, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("Failed to fetch APS token")
            return Response({'error': 'Failed to obtain APS token'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PhotoUploadView(APIView):
    """
    Endpoint for uploading a photo before starting a calculation.
    Returns the temporary photo URL.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        photo = request.FILES.get('photo')
        if not photo:
            return Response({'error': 'No photo provided'}, status=status.HTTP_400_BAD_REQUEST)

        err = _validate_image_upload(photo)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        # Ensure media/uploads directory exists
        upload_dir = os.path.join(settings.MEDIA_ROOT, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)

        ext = os.path.splitext(os.path.basename(photo.name or ''))[1].lower() or '.jpg'
        fs = FileSystemStorage(location=upload_dir, base_url=settings.MEDIA_URL + 'uploads/')
        filename = fs.save(f"{uuid.uuid4().hex}{ext}", photo)
        photo_url = fs.url(filename)

        return Response({'photo_url': photo_url}, status=status.HTTP_201_CREATED)


class CalculationJobViewSet(viewsets.ModelViewSet):
    """
    Handles calculation requests and acts as a catalog/cache for previous results.
    """
    queryset = CalculationJob.objects.select_related('user').all()
    serializer_class = CalculationJobSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_staff or self.request.user.is_superuser:
            return CalculationJob.objects.select_related('user').all()
        if self.request.user.is_authenticated:
            return CalculationJob.objects.select_related('user').filter(user=self.request.user)
        return CalculationJob.objects.none()

    def create(self, request, *args, **kwargs):
        payload_serializer = CalculationPayloadSerializer(data=request.data)
        if not payload_serializer.is_valid():
            return Response(
                {"error": "Invalid payload schema", "details": payload_serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        input_data = dict(payload_serializer.validated_data)
        try:
            validate_calculation_mast_heights(input_data)
        except Exception as e:
            err_detail = getattr(e, 'detail', None) or (e.message_dict if hasattr(e, 'message_dict') else str(e))
            return Response(
                {"error": "Validation de la hauteur du mât échouée", "details": err_detail},
                status=status.HTTP_400_BAD_REQUEST
            )
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

        # Normalize per-equipment sans_plot / with_plot defaults independently
        for eq_key in ("rrh_equipment", "rru_equipment", "fh_equipment"):
            eq_blk = input_data.get(eq_key)
            if isinstance(eq_blk, dict):
                if eq_blk.get("enabled"):
                    kind = eq_key.replace("_equipment", "")
                    is_sp = resolve_sans_plot(input_data, calc_type=calc_type, kind=kind)
                    eq_blk["sans_plot"] = is_sp
                    eq_blk["with_plot"] = not is_sp
                else:
                    eq_blk["enabled"] = False
                    eq_blk["items"] = []

        if (calc_type in ("fh", "fh_sans_plot", "antenna_with_fh", "antenna_with_fh_sans_plot")
                or input_data.get("is_fh")
                or (isinstance(input_data.get("fh_equipment"), dict) and input_data["fh_equipment"].get("enabled"))):
            is_sp = resolve_sans_plot(input_data, kind="fh")
            fh_h = (input_data.get("fh_equipment") or {}).get("hauteur_mat_m") or (input_data.get("structure_fh") or {}).get("hauteur_mat_m") or 1.70
            if not input_data.get("structure_fh") and not input_data.get("is_fh"):
                input_data["structure_fh"] = {
                    "mast_section": "TRON 88x2.5",
                    "plot_section": None if is_sp else "TCAR 150x5",
                    "hauteur_mat_m": fh_h,
                    "hauteur_plot_m": 0.0 if is_sp else 0.50,
                }
            if input_data.get("is_fh") and not input_data.get("structure"):
                input_data["structure"] = {
                    "mast_section": "TRON 88x2.5",
                    "plot_section": None if is_sp else "TCAR 150x5",
                    "hauteur_mat_m": fh_h,
                    "hauteur_plot_m": 0.0 if is_sp else 0.50,
                }

        if input_data.get("sans_plot") is None:
            input_data["sans_plot"] = False

        ndc_hash = compute_ndc_hash(calc_type, input_data)

        # 2. Check Database Cache for Instant Hit
        if not force_recalculate:
            from .services import validate_calculation_artifacts
            # Prefer original non-cached worker jobs first (is_cached=False before is_cached=True), then newest id
            candidate_cached = CalculationJob.objects.filter(
                ndc_hash=ndc_hash,
                status="COMPLETED"
            ).order_by("is_cached", "-id")

            cached_job = None
            for cand in candidate_cached:
                if (cand.compiled_pdf or cand.result_data):
                    missing_in_cand = validate_calculation_artifacts(cand)
                    if not missing_in_cand:
                        cached_job = cand
                        break
                    else:
                        print(f"[NDC HARDENING] Skipping cached Job {cand.id} with incomplete artifacts: {missing_in_cand}")
                        # Immediately mark invalid cached job so it doesn't pollute subsequent queries
                        try:
                            cand.status = 'FAILED'
                            cand.error_message = f"Cache incomplet rejeté : artéfacts obligatoires manquants ({', '.join(missing_in_cand)})."
                            cand.save(update_fields=['status', 'error_message'])
                        except Exception:
                            pass

            if cached_job:
                def _resolve_cached_file(source_job, field_name, candidate_rel_paths):
                    field_val = getattr(source_job, field_name, None)
                    if field_val and bool(getattr(field_val, 'name', None)):
                        abs_p = os.path.join(settings.MEDIA_ROOT, field_val.name)
                        if os.path.exists(abs_p):
                            return field_val.name
                    for rel_p in candidate_rel_paths:
                        abs_p = os.path.join(settings.MEDIA_ROOT, rel_p)
                        if os.path.exists(abs_p):
                            return rel_p
                    return None

                screenshot = _resolve_cached_file(
                    cached_job, 'screenshot',
                    [f'screenshots/job_{cached_job.id}_3d_view.jpg']
                )
                verification_screenshot = _resolve_cached_file(
                    cached_job, 'verification_screenshot',
                    [
                        f'screenshots/verification/job_{cached_job.id}_verification.jpg',
                        f'screenshots/job_{cached_job.id}_verification.jpg',
                        f'screenshots/verification/job_{cached_job.id}_antenna_verification.jpg',
                        f'screenshots/job_{cached_job.id}_antenna_verification.jpg'
                    ]
                )
                note_de_calcul = _resolve_cached_file(
                    cached_job, 'note_de_calcul',
                    [
                        f'notes_de_calcul/job_{cached_job.id}_note_de_calcul.rtf',
                        f'notes_de_calcul/job_{cached_job.id}_antenna_note_de_calcul.rtf'
                    ]
                )
                note_mat = _resolve_cached_file(
                    cached_job, 'note_mat',
                    [
                        f'notes_de_calcul/job_{cached_job.id}_antenna_note_mat.rtf',
                        f'notes_rrh/job_{cached_job.id}_rrh_note_mat.rtf',
                        f'notes_de_calcul/job_{cached_job.id}_rrh_note_mat.rtf'
                    ]
                )
                note_plot = _resolve_cached_file(
                    cached_job, 'note_plot',
                    [
                        f'notes_de_calcul/job_{cached_job.id}_antenna_note_plot.rtf',
                        f'notes_rrh/job_{cached_job.id}_rrh_note_plot.rtf',
                        f'notes_de_calcul/job_{cached_job.id}_rrh_note_plot.rtf'
                    ]
                )
                assemblage_note = _resolve_cached_file(
                    cached_job, 'assemblage_note',
                    [
                        f'assemblages/job_{cached_job.id}_assemblage_note.rtf',
                        f'assemblages/job_{cached_job.id}_antenna_assemblage_note.rtf'
                    ]
                )
                reactions_file = _resolve_cached_file(
                    cached_job, 'reactions_file',
                    [f'reactions/job_{cached_job.id}_reactions.txt']
                )

                # Dedicated RRH Support Files
                note_de_calcul_rrh = _resolve_cached_file(
                    cached_job, 'note_de_calcul_rrh',
                    [
                        f'notes_rrh/job_{cached_job.id}_rrh_note_de_calcul.rtf',
                        f'notes_de_calcul/job_{cached_job.id}_rrh_note_de_calcul.rtf'
                    ]
                )
                rrh_assemblage_note = _resolve_cached_file(
                    cached_job, 'rrh_assemblage_note',
                    [
                        f'notes_rrh/job_{cached_job.id}_rrh_assemblage_note.rtf',
                        f'assemblages/job_{cached_job.id}_rrh_assemblage_note.rtf'
                    ]
                )
                rrh_verification_screenshot = _resolve_cached_file(
                    cached_job, 'rrh_verification_screenshot',
                    [f'verif_rrh/job_{cached_job.id}_rrh_verification.jpg']
                )
                rrh_tableau_charges = _resolve_cached_file(
                    cached_job, 'rrh_tableau_charges',
                    [f'charges_rrh/job_{cached_job.id}_rrh_tableau_charges.png']
                )
                rrh_reactions_file = _resolve_cached_file(
                    cached_job, 'rrh_reactions_file',
                    [f'reactions_rrh/job_{cached_job.id}_rrh_reactions.txt']
                )
                rrh_screenshot = _resolve_cached_file(
                    cached_job, 'rrh_screenshot',
                    [f'screenshots_rrh/job_{cached_job.id}_rrh_3d_view.jpg']
                )

                # Dedicated FH Support Files
                note_de_calcul_fh = _resolve_cached_file(
                    cached_job, 'note_de_calcul_fh',
                    [
                        f'notes_fh/job_{cached_job.id}_fh_note_de_calcul.rtf',
                        f'notes_fh/job_{cached_job.id}_fh_note_de_calcul.pdf',
                        f'notes_de_calcul/job_{cached_job.id}_fh_note_de_calcul.rtf'
                    ]
                )
                fh_note_mat = _resolve_cached_file(
                    cached_job, 'fh_note_mat',
                    [
                        f'notes_fh/job_{cached_job.id}_fh_note_mat.rtf',
                        f'notes_de_calcul/job_{cached_job.id}_fh_note_mat.rtf'
                    ]
                )
                fh_note_plot = _resolve_cached_file(
                    cached_job, 'fh_note_plot',
                    [
                        f'notes_fh/job_{cached_job.id}_fh_note_plot.rtf',
                        f'notes_de_calcul/job_{cached_job.id}_fh_note_plot.rtf'
                    ]
                )
                fh_assemblage_note = _resolve_cached_file(
                    cached_job, 'fh_assemblage_note',
                    [
                        f'notes_fh/job_{cached_job.id}_fh_assemblage_note.rtf',
                        f'assemblages/job_{cached_job.id}_fh_assemblage_note.rtf'
                    ]
                )
                fh_verification_screenshot = _resolve_cached_file(
                    cached_job, 'fh_verification_screenshot',
                    [f'verif_fh/job_{cached_job.id}_fh_verification.jpg']
                )
                fh_tableau_charges = _resolve_cached_file(
                    cached_job, 'fh_tableau_charges',
                    [f'charges_fh/job_{cached_job.id}_fh_tableau_charges.png']
                )
                fh_reactions_file = _resolve_cached_file(
                    cached_job, 'fh_reactions_file',
                    [f'reactions_fh/job_{cached_job.id}_fh_reactions.txt']
                )
                fh_screenshot = _resolve_cached_file(
                    cached_job, 'fh_screenshot',
                    [f'screenshots_fh/job_{cached_job.id}_fh_3d_view.jpg']
                )

                compiled_docx = cached_job.compiled_docx.name if (cached_job.compiled_docx and bool(cached_job.compiled_docx.name)) else None
                compiled_pdf = cached_job.compiled_pdf.name if (cached_job.compiled_pdf and bool(cached_job.compiled_pdf.name)) else None

                # Create a cloned record with all artifacts preserved
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
                    screenshot=screenshot,
                    verification_screenshot=verification_screenshot,
                    note_de_calcul=note_de_calcul,
                    note_mat=note_mat,
                    note_plot=note_plot,
                    assemblage_note=assemblage_note,
                    reactions_file=reactions_file,
                    note_de_calcul_rrh=note_de_calcul_rrh,
                    rrh_assemblage_note=rrh_assemblage_note,
                    rrh_verification_screenshot=rrh_verification_screenshot,
                    rrh_tableau_charges=rrh_tableau_charges,
                    rrh_reactions_file=rrh_reactions_file,
                    rrh_screenshot=rrh_screenshot,
                    note_de_calcul_fh=note_de_calcul_fh,
                    fh_note_mat=fh_note_mat,
                    fh_note_plot=fh_note_plot,
                    fh_assemblage_note=fh_assemblage_note,
                    fh_verification_screenshot=fh_verification_screenshot,
                    fh_tableau_charges=fh_tableau_charges,
                    fh_reactions_file=fh_reactions_file,
                    fh_screenshot=fh_screenshot,
                    compiled_docx=compiled_docx,
                    compiled_pdf=compiled_pdf,
                )

                # Post-clone hardened validation: verify the cloned job is 100% complete
                missing_in_new = validate_calculation_artifacts(new_job)
                if missing_in_new:
                    print(f"[NDC HARDENING ERROR] Cloned Job {new_job.id} failed artifact validation: {missing_in_new}. Discarding cache hit and recalculating.")
                    new_job.status = 'FAILED'
                    new_job.error_message = f"Calcul dupliqué incomplet : artéfacts manquants ({', '.join(missing_in_new)})"
                    new_job.save(update_fields=['status', 'error_message'])
                else:
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

        # 4. Dispatch to Unified Robot Worker via Django-Q2 (zero-Redis PostgreSQL queue)
        job_id = job.id
        transaction.on_commit(lambda: enqueue_task('api.tasks.send_job_to_worker', job_id))

        serializer = self.get_serializer(job)
        return Response({
            "message": f"{calc_type.upper()} Calculation enqueued successfully.",
            "calculation_id": job.id,
            "ndc_hash": ndc_hash,
            "cached": False,
            "status": "PENDING",
            "data": serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['post'],
        parser_classes=[MultiPartParser, FormParser, JSONParser],
        permission_classes=[IsRobotWorkerOrAdminPermission],
    )
    def complete(self, request, pk=None):
        """
        Endpoint for Unified Robot Worker to submit calculation results and artifacts.
        Worker calls POST /api/calculations/<id>/complete/
        """
        job = get_object_or_404(CalculationJob, pk=pk)
        previous_status = job.status

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

        # Save uploaded artifact files from worker across ALL active stages independently
        files = request.FILES
        inp = job.input_data if isinstance(job.input_data, dict) else {}
        calc_type_low = str(job.calculation_type or "").lower()
        active_eqs = result_data.get("active_equipments") if isinstance(result_data.get("active_equipments"), list) else []

        has_base_antenna = (
            calc_type_low == "antenna"
            or calc_type_low.startswith("antenna_with_")
            or bool(inp.get("antenna_4g") or inp.get("antenna_5g"))
        ) and calc_type_low not in ("rrh", "rrh_sans_plot", "rru", "rru_sans_plot", "fh", "fh_sans_plot")

        has_rrh = (
            bool(result_data.get("has_rrh"))
            or "rrh" in active_eqs
            or bool((inp.get("rrh_equipment") or {}).get("enabled"))
            or bool(inp.get("is_rrh"))
            or "rrh" in calc_type_low
        )
        has_rru = (
            bool(result_data.get("has_rru"))
            or "rru" in active_eqs
            or bool((inp.get("rru_equipment") or {}).get("enabled"))
            or bool(inp.get("is_rru"))
            or "rru" in calc_type_low
        )
        has_fh = (
            bool(result_data.get("has_fh"))
            or bool(result_data.get("is_fh"))
            or "fh" in active_eqs
            or bool((inp.get("fh_equipment") or {}).get("enabled"))
            or bool(inp.get("is_fh"))
            or "fh" in calc_type_low
        )
        is_pure_fh = (calc_type_low in ("fh", "fh_sans_plot")) and not has_base_antenna and not has_rrh and not has_rru

        def _save_stage_uploaded_file(file_obj, subdir, filename):
            target_dir = os.path.join(settings.MEDIA_ROOT, subdir)
            os.makedirs(target_dir, exist_ok=True)
            target_path = os.path.join(target_dir, filename)
            with open(target_path, 'wb+') as dest:
                for chunk in file_obj.chunks():
                    dest.write(chunk)
            if hasattr(file_obj, 'seek'):
                try:
                    file_obj.seek(0)
                except Exception:
                    pass
            return target_path

        # 1. Base Antenna Files (accepting standard and worker aliases)
        if not is_pure_fh:
            if 'screenshot' in files:
                job.screenshot = files['screenshot']
            elif 'antenna_screenshot' in files:
                job.screenshot = files['antenna_screenshot']

            if 'verification_screenshot' in files:
                job.verification_screenshot = files['verification_screenshot']
            elif 'antenna_verification_screenshot' in files:
                job.verification_screenshot = files['antenna_verification_screenshot']
            elif 'verification_view' in files:
                job.verification_screenshot = files['verification_view']

            if 'note_de_calcul' in files:
                job.note_de_calcul = files['note_de_calcul']
            elif 'antenna_note_de_calcul' in files:
                job.note_de_calcul = files['antenna_note_de_calcul']
            elif 'antenna_note_mat' in files:
                job.note_de_calcul = files['antenna_note_mat']
            elif 'note_mat' in files and has_base_antenna and not has_rrh:
                job.note_de_calcul = files['note_mat']

            if 'assemblage_note' in files:
                job.assemblage_note = files['assemblage_note']
            elif 'antenna_assemblage_note' in files:
                job.assemblage_note = files['antenna_assemblage_note']

            if 'reactions_file' in files:
                job.reactions_file = files['reactions_file']
            elif 'antenna_reactions_file' in files:
                job.reactions_file = files['antenna_reactions_file']

        # 2. RRH Support Files (Independent block: saved even when FH is also active on the same job!)
        if has_rrh or any(k in files for k in (
            'note_de_calcul_rrh', 'rrh_note_de_calcul', 'rrh_note_mat', 'rrh_note_plot',
            'rrh_assemblage_note', 'rrh_verification_screenshot', 'rrh_tableau_charges',
            'rrh_loads_table', 'rrh_reactions_file', 'rrh_screenshot',
        )):
            rrh_files_saved = {}
            rrh_ndc = files.get("note_de_calcul_rrh") or files.get("rrh_note_de_calcul") or files.get("rrh_note_mat")
            if rrh_ndc:
                job.note_de_calcul_rrh = rrh_ndc
                ext = os.path.splitext(rrh_ndc.name)[1] or ".rtf"
                rrh_files_saved["note_de_calcul"] = _save_stage_uploaded_file(rrh_ndc, "notes_rrh", f"job_{job.id}_rrh_note_de_calcul{ext}")

            note_mat = files.get("rrh_note_mat") or rrh_ndc or (files.get("note_mat") if not is_pure_fh and not has_rru else None)
            if note_mat and "_rru_" not in (getattr(note_mat, "name", "") or "").lower():
                job.note_mat = note_mat
                rrh_files_saved["note_mat"] = _save_stage_uploaded_file(note_mat, "notes_rrh", f"job_{job.id}_rrh_note_mat.rtf")

            note_plot = files.get("rrh_note_plot") or (files.get("note_plot") if not is_pure_fh and not has_rru else None)
            if note_plot and "_rru_" not in (getattr(note_plot, "name", "") or "").lower():
                job.note_plot = note_plot
                rrh_files_saved["note_plot"] = _save_stage_uploaded_file(note_plot, "notes_rrh", f"job_{job.id}_rrh_note_plot.rtf")

            rrh_ass = files.get("rrh_assemblage_note") or files.get("note_assemblage_rrh")
            if rrh_ass:
                job.rrh_assemblage_note = rrh_ass
                rrh_files_saved["assemblage_note"] = _save_stage_uploaded_file(rrh_ass, "notes_rrh", f"job_{job.id}_rrh_assemblage_note.rtf")

            if 'rrh_verification_screenshot' in files:
                job.rrh_verification_screenshot = files['rrh_verification_screenshot']
                rrh_files_saved["rrh_verification_screenshot"] = _save_stage_uploaded_file(files['rrh_verification_screenshot'], "verif_rrh", f"job_{job.id}_rrh_verification.jpg")

            charges_img = files.get("rrh_tableau_charges") or files.get("rrh_loads_table") or (files.get("loads_table") if not is_pure_fh and not has_rru else None)
            if charges_img:
                job.rrh_tableau_charges = charges_img
                rrh_files_saved["rrh_tableau_charges"] = _save_stage_uploaded_file(charges_img, "charges_rrh", f"job_{job.id}_rrh_tableau_charges.png")

            if 'rrh_reactions_file' in files:
                job.rrh_reactions_file = files['rrh_reactions_file']
                rrh_files_saved["rrh_reactions_file"] = _save_stage_uploaded_file(files['rrh_reactions_file'], "reactions_rrh", f"job_{job.id}_rrh_reactions.txt")

            if 'rrh_screenshot' in files:
                job.rrh_screenshot = files['rrh_screenshot']
                rrh_files_saved["rrh_screenshot"] = _save_stage_uploaded_file(files['rrh_screenshot'], "screenshots_rrh", f"job_{job.id}_rrh_3d_view.jpg")

            if rrh_files_saved:
                if not isinstance(job.result_data, dict):
                    job.result_data = {}
                existing_rrh_files = job.result_data.get("rrh_files") if isinstance(job.result_data.get("rrh_files"), dict) else {}
                existing_rrh_files.update(rrh_files_saved)
                job.result_data["rrh_files"] = existing_rrh_files

        # 3. RRU Support Files (Independent block: saved even when FH is also active on the same job!)
        if has_rru or any(k in files for k in (
            'note_de_calcul_rru', 'rru_note_de_calcul', 'rru_note_mat', 'rru_note_plot',
            'rru_assemblage_note', 'rru_verification_screenshot', 'rru_tableau_charges',
            'rru_loads_table', 'rru_reactions_file', 'rru_screenshot',
        )):
            rru_files_saved = {}
            rru_ndc = files.get("note_de_calcul_rru") or files.get("rru_note_de_calcul")
            if rru_ndc:
                ext = os.path.splitext(rru_ndc.name)[1] or ".rtf"
                rru_files_saved["note_de_calcul"] = _save_stage_uploaded_file(rru_ndc, "notes_rru", f"job_{job.id}_rru_note_de_calcul{ext}")

            rru_mat = files.get("rru_note_mat") or rru_ndc
            if rru_mat:
                rru_files_saved["note_mat"] = _save_stage_uploaded_file(rru_mat, "notes_rru", f"job_{job.id}_rru_note_mat.rtf")
            if 'rru_note_plot' in files:
                rru_files_saved["note_plot"] = _save_stage_uploaded_file(files['rru_note_plot'], "notes_rru", f"job_{job.id}_rru_note_plot.rtf")
            if 'rru_assemblage_note' in files:
                rru_files_saved["assemblage_note"] = _save_stage_uploaded_file(files['rru_assemblage_note'], "notes_rru", f"job_{job.id}_rru_assemblage_note.rtf")
            if 'rru_verification_screenshot' in files:
                rru_files_saved["rru_verification_screenshot"] = _save_stage_uploaded_file(files['rru_verification_screenshot'], "verif_rru", f"job_{job.id}_rru_verification.jpg")
            rru_charges = files.get("rru_tableau_charges") or files.get("rru_loads_table")
            if rru_charges:
                rru_files_saved["rru_tableau_charges"] = _save_stage_uploaded_file(rru_charges, "charges_rru", f"job_{job.id}_rru_tableau_charges.png")
            if 'rru_reactions_file' in files:
                rru_files_saved["rru_reactions_file"] = _save_stage_uploaded_file(files['rru_reactions_file'], "reactions_rru", f"job_{job.id}_rru_reactions.txt")
            if 'rru_screenshot' in files:
                rru_files_saved["rru_screenshot"] = _save_stage_uploaded_file(files['rru_screenshot'], "screenshots_rru", f"job_{job.id}_rru_3d_view.jpg")

            if rru_files_saved:
                if not isinstance(job.result_data, dict):
                    job.result_data = {}
                existing_rru_files = job.result_data.get("rru_files") if isinstance(job.result_data.get("rru_files"), dict) else {}
                existing_rru_files.update(rru_files_saved)
                job.result_data["rru_files"] = existing_rru_files

        # 4. FH Support Files (Independent block: saved alongside Base Antenna and RRH/RRU)
        if has_fh or any(k in files for k in (
            'note_de_calcul_fh', 'fh_note_de_calcul', 'fh_note_mat', 'fh_note_plot',
            'fh_assemblage_note', 'fh_verification_screenshot', 'fh_tableau_charges',
            'fh_loads_table', 'fh_reactions_file', 'fh_screenshot',
        )):
            fh_files_saved = {}
            fh_ndc = files.get("note_de_calcul_fh") or files.get("fh_note_de_calcul") or (files.get("note_de_calcul") if is_pure_fh else None)
            if fh_ndc:
                job.note_de_calcul_fh = fh_ndc
                ext = os.path.splitext(fh_ndc.name)[1] or ".rtf"
                fh_files_saved["note_de_calcul"] = _save_stage_uploaded_file(fh_ndc, "notes_fh", f"job_{job.id}_fh_note_de_calcul{ext}")

            fh_mat = files.get("fh_note_mat") or fh_ndc or (files.get("note_mat") if is_pure_fh else None)
            if fh_mat:
                job.fh_note_mat = fh_mat
                fh_files_saved["note_mat"] = _save_stage_uploaded_file(fh_mat, "notes_fh", f"job_{job.id}_fh_note_mat.rtf")

            fh_plot = files.get("fh_note_plot") or (files.get("note_plot") if is_pure_fh else None)
            if fh_plot:
                job.fh_note_plot = fh_plot
                fh_files_saved["note_plot"] = _save_stage_uploaded_file(fh_plot, "notes_fh", f"job_{job.id}_fh_note_plot.rtf")

            fh_ass = files.get("fh_assemblage_note") or (files.get("assemblage_note") if is_pure_fh else None)
            if fh_ass:
                job.fh_assemblage_note = fh_ass
                fh_files_saved["assemblage_note"] = _save_stage_uploaded_file(fh_ass, "notes_fh", f"job_{job.id}_fh_assemblage_note.rtf")

            fh_verif = files.get("fh_verification_screenshot") or (files.get("verification_screenshot") if is_pure_fh else None)
            if fh_verif:
                job.fh_verification_screenshot = fh_verif
                fh_files_saved["fh_verification_screenshot"] = _save_stage_uploaded_file(fh_verif, "verif_fh", f"job_{job.id}_fh_verification.jpg")

            fh_charges = files.get("fh_tableau_charges") or files.get("fh_loads_table") or (files.get("loads_table") if is_pure_fh else None)
            if fh_charges:
                job.fh_tableau_charges = fh_charges
                fh_files_saved["fh_tableau_charges"] = _save_stage_uploaded_file(fh_charges, "charges_fh", f"job_{job.id}_fh_tableau_charges.png")

            fh_reactions = files.get("fh_reactions_file") or (files.get("reactions_file") if is_pure_fh else None)
            if fh_reactions:
                job.fh_reactions_file = fh_reactions
                fh_files_saved["fh_reactions_file"] = _save_stage_uploaded_file(fh_reactions, "reactions_fh", f"job_{job.id}_fh_reactions.txt")

            fh_screenshot = files.get("fh_screenshot") or (files.get("screenshot") if is_pure_fh else None)
            if fh_screenshot:
                job.fh_screenshot = fh_screenshot
                fh_files_saved["fh_screenshot"] = _save_stage_uploaded_file(fh_screenshot, "screenshots_fh", f"job_{job.id}_fh_3d_view.jpg")

            if fh_files_saved:
                if not isinstance(job.result_data, dict):
                    job.result_data = {}
                existing_fh_files = job.result_data.get("fh_files") if isinstance(job.result_data.get("fh_files"), dict) else {}
                existing_fh_files.update(fh_files_saved)
                job.result_data["fh_files"] = existing_fh_files

        # 5. Strict Quality & Completeness Validation
        from .services import validate_calculation_artifacts
        missing_artifacts = []
        if job_status == 'COMPLETED':
            missing_artifacts = validate_calculation_artifacts(job, files)
            if missing_artifacts:
                job_status = 'FAILED'
                error_message = (
                    f"Calcul Robot rejeté : le worker a signalé un statut COMPLETED, mais "
                    f"les artéfacts obligatoires suivants sont manquants : {', '.join(missing_artifacts)}. "
                    f"La note de calcul ne sera pas finalisée afin de ne pas transmettre un document incomplet."
                )
                print(f"[NDC HARDENING ERROR] Job {job.id} REJECTED due to missing artifacts: {missing_artifacts}")
                logger.error(f"[NDC HARDENING ERROR] Job {job.id} REJECTED due to missing artifacts: {error_message}")

        job.status = job_status
        job.error_message = error_message

        # Atomic & idempotent quota update: only charge when transitioning into COMPLETED
        with transaction.atomic():
            if job_status == 'COMPLETED' and previous_status != 'COMPLETED' and job.user_id:
                ClientSubscription.objects.filter(user_id=job.user_id).update(
                    used_quota=F('used_quota') + job.credits_consumed
                )
            job.save()

        # Enqueue backend document compilation (DOCX / PDF) on qcluster so callback returns fast
        if job_status == 'COMPLETED':
            job_id_to_compile = job.id
            transaction.on_commit(
                lambda: enqueue_task('api.tasks.compile_job_documents_task', job_id_to_compile)
            )

        # Broadcast completion or failure to WebSocket listeners immediately
        _broadcast_calc_progress(job.id, {
            "job_id": job.id,
            "stage": "COMPLETED" if job_status == "COMPLETED" else "FAILED",
            "percent": 100 if job_status == "COMPLETED" else 0,
            "message": "Calcul terminé avec succès" if job_status == "COMPLETED" else "Échec du calcul Robot",
            "status": job_status,
            "is_completed": job_status == "COMPLETED",
        })

        if job_status != 'COMPLETED':
            return Response({
                "status": "FAILED",
                "error": job.error_message,
                "missing_artifacts": missing_artifacts,
            }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        serializer = self.get_serializer(job)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['post'],
        parser_classes=[MultiPartParser, FormParser, JSONParser],
        permission_classes=[IsRobotWorkerOrAdminPermission],
    )
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
        _broadcast_calc_progress(job.id, {
            "job_id": job.id,
            "stage": stage,
            "percent": percent,
            "message": message,
            "details": details,
            "status": job.status,
            "is_completed": False,
        })

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

                operator_name = normalize_operator(
                    request.data.get('operator') or request.data.get('operateur'),
                    fallback_site=preview_data.get('site'),
                )
                if operator_name in OPERATORS_WITHOUT_TD and 'td_equipment' in preview_data and isinstance(preview_data['td_equipment'], dict):
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
                        
                # Catalogue paths (strictly confined to MEDIA_ROOT)
                for cat_url in catalogue_pdf_urls:
                    cat_abs_path = safe_media_path(cat_url)
                    if not cat_abs_path:
                        continue
                    cat_rel_path = os.path.relpath(cat_abs_path, settings.MEDIA_ROOT)
                    if not cat_rel_path.lower().endswith('.pdf'):
                        from geodata.utils_preview import get_pdf_preview_path
                        pdf_rel_path = get_pdf_preview_path(cat_rel_path)
                        if pdf_rel_path:
                            cat_abs_path = safe_media_path(pdf_rel_path)
                    if cat_abs_path and os.path.isfile(cat_abs_path):
                        from pypdf import PdfReader
                        reader = PdfReader(cat_abs_path)
                        for i, page in enumerate(reader.pages):
                            if i in [0, 1]:  # Skip pages 1-2 of catalogue - already generated by template
                                continue
                            merger.add_page(page)
                
                has_any_eq = False
                for eq_key in ['fh_equipment', 'rrh_equipment', 'rru_equipment', 'td_equipment', 'gps', 'boitier_lovage', 'coffrets_fibre']:
                    eq = preview_data.get(eq_key, {})
                    if isinstance(eq, dict) and eq.get('enabled'):
                        if eq_key == 'td_equipment' and operator_name in OPERATORS_WITHOUT_TD:
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

            # Batch pre-conversion of all RTF files across jobs and auxiliary equipment
            # Guarantees zero cross-job leakage and reduces multiple LibreOffice cold starts to one.
            from geodata.ndc_generator import collect_site_ndc_rtf_specs, _batch_convert_rtf_files
            jobs_by_id = CalculationJob.objects.select_related('user').in_bulk(job_ids)
            missing_ids = [jid for jid in job_ids if jid not in jobs_by_id]
            if missing_ids:
                return Response(
                    {'error': f"Job(s) introuvable(s): {missing_ids}"},
                    status=status.HTTP_404_NOT_FOUND
                )
            jobs = [jobs_by_id[jid] for jid in job_ids]

            # Ownership check (prevent IDOR across users)
            if not (request.user.is_staff or request.user.is_superuser):
                for job in jobs:
                    if job.user_id and job.user_id != request.user.id:
                        return Response(
                            {'error': "Accès refusé à l'un des calculs demandés."},
                            status=status.HTTP_403_FORBIDDEN
                        )

            # Hardened Validation: Never assemble a site NDC if any sector calculation failed or is incomplete
            from .services import validate_calculation_artifacts
            for i, job in enumerate(jobs):
                if job.status != 'COMPLETED':
                    return Response({
                        'error': f"Le secteur {i+1} (Job {job.id}) a le statut '{job.status}'. "
                                 f"Erreur associée : {job.error_message or 'Calcul en cours ou incomplet'}. "
                                 f"La génération du document de synthèse est bloquée pour éviter un PDF tronqué."
                    }, status=status.HTTP_400_BAD_REQUEST)

                missing_artifacts = validate_calculation_artifacts(job)
                if missing_artifacts:
                    return Response({
                        'error': f"Le secteur {i+1} (Job {job.id}) est incomplet : artéfacts obligatoires manquants ({', '.join(missing_artifacts)}). "
                                 f"La génération du document de synthèse est bloquée pour éviter la livraison d'un PDF incomplet. "
                                 f"Veuillez relancer le calcul pour ce secteur."
                    }, status=status.HTTP_400_BAD_REQUEST)

            rtf_specs = collect_site_ndc_rtf_specs(jobs)
            preconverted_images = _batch_convert_rtf_files(rtf_specs) if rtf_specs else {}

            for i, job in enumerate(jobs):
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
                    
                pdf_url = generate_ndc_pdf(job, job_photo_url, is_subsequent_sector=is_subsequent, start_page=total_pages + 1, preconverted_images=preconverted_images)
                
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
            if jobs:
                first_job = jobs[0]
                aux_pdf_paths = generate_auxiliary_pdfs(first_job, start_page=total_pages + 1, preconverted_images=preconverted_images)
                for aux_path in aux_pdf_paths:
                    if os.path.exists(aux_path):
                        temp_pdfs.append(aux_path)
                        merger.append(aux_path)
    
            output_filename = f"SITE_NDC_{uuid.uuid4().hex[:8]}.pdf"
            outdir = os.path.join(settings.MEDIA_ROOT, 'uploads')
            os.makedirs(outdir, exist_ok=True)
            
            merged_pdf_path = os.path.join(outdir, output_filename)
            try:
                merger.write(merged_pdf_path)
            finally:
                merger.close()
                for tmp_pdf in temp_pdfs:
                    if tmp_pdf and tmp_pdf != merged_pdf_path and os.path.isfile(tmp_pdf):
                        try:
                            os.remove(tmp_pdf)
                        except OSError:
                            pass
            
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
    permission_classes = [IsRobotWorkerOrAdminPermission]

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

from django.http import FileResponse, Http404, HttpResponseForbidden
import mimetypes


def download_note_de_calcul(request, client_id, filename):
    # 1. Verify user owns this client_id (or is staff)
    if not request.user.is_authenticated or (
        f"client_{request.user.id}" != client_id and not request.user.is_staff
    ):
        return HttpResponseForbidden("Unauthorized")

    # 2. Stream safely from MEDIA_ROOT (Caddy compatible, no Nginx X-Accel-Redirect)
    full_path = safe_resolve_under(settings.MEDIA_ROOT, os.path.join(client_id, os.path.basename(filename)))
    if not full_path or not os.path.isfile(full_path):
        raise Http404("File not found")

    content_type, _ = mimetypes.guess_type(full_path)
    return FileResponse(
        open(full_path, 'rb'),
        content_type=content_type or 'application/octet-stream',
        as_attachment=True,
        filename=os.path.basename(full_path),
    )
