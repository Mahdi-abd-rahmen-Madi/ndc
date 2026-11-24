import os
from unittest.mock import patch

import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from api.models import CalculationJob, ClientSubscription
from api.tasks import send_job_to_worker
from api.worker_status import WORKER_STATUS_CACHE_KEY
from utils.domain_constants import (
    OPERATORS_WITHOUT_TD,
    V_B0_TO_REGION,
    WIND_REGION_VB0,
    normalize_operator,
    resolve_sans_plot,
)
from utils.libreoffice import convert_to_pdf
from utils.ndc_hash import compute_ndc_hash
from utils.path_security import safe_media_path, safe_resolve_under


class SecurityAndDomainUtilsTest(SimpleTestCase):
    def test_safe_resolve_under_blocks_traversal_and_absolute_paths(self):
        root = str(settings.MEDIA_ROOT)
        self.assertIsNone(safe_resolve_under(root, "/etc/passwd"))
        self.assertIsNone(safe_resolve_under(root, "../../etc/passwd"))
        self.assertIsNone(safe_resolve_under(root, "../media_sibling/secret.txt"))
        valid = safe_resolve_under(root, "uploads/report.pdf")
        self.assertIsNotNone(valid)
        self.assertTrue(valid.startswith(os.path.realpath(root)))

    def test_safe_media_path_strips_media_url_safely(self):
        self.assertIsNone(safe_media_path("/etc/passwd"))
        self.assertIsNone(safe_media_path("/media/../../settings.py"))
        ok = safe_media_path("/media/uploads/sample.png")
        self.assertIsNotNone(ok)
        self.assertTrue(ok.endswith(os.path.join("uploads", "sample.png")))

    def test_domain_constants_and_operator_normalization(self):
        self.assertEqual(normalize_operator("Bytel"), "bouygues")
        self.assertEqual(normalize_operator("BOUYGUES TELECOM"), "bouygues")
        self.assertEqual(normalize_operator("Orange"), "orange")
        self.assertIn("bouygues", OPERATORS_WITHOUT_TD)
        self.assertIn("orange", OPERATORS_WITHOUT_TD)
        self.assertNotIn("free", OPERATORS_WITHOUT_TD)
        for region, vb0 in WIND_REGION_VB0.items():
            self.assertEqual(V_B0_TO_REGION[vb0], region)

    def test_resolve_sans_plot_and_ndc_hash_determinism(self):
        self.assertTrue(resolve_sans_plot({"rrh_sans_plot": True}, {}, kind="rrh"))
        self.assertFalse(resolve_sans_plot({"rrh_sans_plot": False}, {}, kind="rrh"))

        payload_a = {
            "operateur": "bytel",
            "environment": {"region": 2, "terrain_type": "IIIa", "building_height_m": 20},
            "structure": {"hauteur_mat_m": 4, "mat_principal": "TRON 139x6.3"},
        }
        payload_b = {
            "operateur": "bouygues",
            "environment": {"region": 2, "terrain_type": "IIIa", "building_height_m": 20},
            "structure": {"hauteur_mat_m": 4, "mat_principal": "TRON 139x6.3"},
        }
        self.assertEqual(compute_ndc_hash("antenna", payload_a), compute_ndc_hash("antenna", payload_b))

    def test_libreoffice_empty_input_and_isolated_profile(self):
        self.assertEqual(convert_to_pdf([], "/tmp"), [])
        with patch("utils.libreoffice.subprocess.run") as mock_run:
            convert_to_pdf(["/tmp/nonexistent.rtf"], "/tmp/out_test", timeout=30)
            mock_run.assert_called_once()
            cmd = mock_run.call_args[0][0]
            self.assertTrue(any(arg.startswith("-env:UserInstallation=file://") for arg in cmd))
            self.assertIn("--headless", cmd)


class ApiAuthAndPermissionsTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="client@example.com",
            email="client@example.com",
            password="StrongClientPassword123!",
        )
        self.token = Token.objects.create(user=self.user)
        self.admin = User.objects.create_superuser(
            username="admin@example.com",
            email="admin@example.com",
            password="StrongAdminPassword123!",
        )
        self.admin_token = Token.objects.create(user=self.admin)

    def test_login_rejects_blank_credentials(self):
        resp = self.client.post("/api/auth/login/", {"email": "", "password": ""}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_register_enforces_password_validation(self):
        resp = self.client.post(
            "/api/auth/register/",
            {"email": "new@example.com", "password": "123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_calculations_endpoint_requires_authentication(self):
        resp = self.client.get("/api/calculations/")
        self.assertIn(resp.status_code, (401, 403))

    @override_settings(ROBOT_WORKER_API_KEY="test-worker-secret")
    def test_calculation_complete_requires_worker_key_and_is_idempotent_on_quota(self):
        sub = ClientSubscription.objects.create(user=self.user, monthly_quota=10, used_quota=0)
        job = CalculationJob.objects.create(
            user=self.user,
            status="RUNNING",
            credits_consumed=1,
            input_data={"operateur": "orange"},
        )

        # Regular authenticated user cannot spoof worker completion
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        forbidden = self.client.post(f"/api/calculations/{job.id}/complete/", {"status": "COMPLETED"}, format="json")
        self.assertEqual(forbidden.status_code, 403)

        # Valid worker key without artifacts is rejected with 422 (artifact hardening guard)
        self.client.credentials(HTTP_X_WORKER_API_KEY="test-worker-secret")
        incomplete = self.client.post(
            f"/api/calculations/{job.id}/complete/",
            {"status": "COMPLETED", "result_data": {"ok": True}},
            format="json",
        )
        self.assertEqual(incomplete.status_code, 422)

        # Valid worker key with complete artifacts succeeds and increments quota exactly once even if retried
        with patch("api.services.validate_calculation_artifacts", return_value=[]), \
             patch("api.views.enqueue_task") as mock_enqueue, \
             patch("api.views._broadcast_calc_progress"), \
             self.captureOnCommitCallbacks(execute=True):
            first = self.client.post(
                f"/api/calculations/{job.id}/complete/",
                {"status": "COMPLETED", "result_data": {"ok": True}},
                format="json",
            )
            self.assertEqual(first.status_code, 200)

            second = self.client.post(
                f"/api/calculations/{job.id}/complete/",
                {"status": "COMPLETED", "result_data": {"ok": True}},
                format="json",
            )
            self.assertEqual(second.status_code, 200)
        self.assertTrue(mock_enqueue.called)

        sub.refresh_from_db()
        self.assertEqual(sub.used_quota, 1)

        job.refresh_from_db()
        self.assertEqual((job.result_data or {}).get("progress", {}).get("percent"), 100)
        self.assertEqual((job.result_data or {}).get("progress", {}).get("stage"), "COMPLETED")

    def test_callback_url_ignored_in_ndc_hash_and_forwarded_to_worker(self):
        base_payload = {
            "operateur": "orange",
            "environment": {"region": 2, "terrain_type": "IIIa", "building_height_m": 20},
            "structure": {"hauteur_mat_m": 4, "mat_principal": "TRON 139x6.3"},
        }
        with_cb = {**base_payload, "_callback_url": "https://api-ndc.heliosys.io"}
        self.assertEqual(compute_ndc_hash("antenna", base_payload), compute_ndc_hash("antenna", with_cb))

        job = CalculationJob.objects.create(
            user=self.user,
            status="PENDING",
            input_data={"_callback_url": "https://api-ndc.heliosys.io", "operateur": "orange"},
        )
        with patch("api.tasks.close_old_connections"), patch("api.tasks.requests.post") as mock_post:
            mock_post.return_value.status_code = 202
            ok = send_job_to_worker(job.id)
            self.assertTrue(ok)
            sent = mock_post.call_args.kwargs["json"]
            self.assertEqual(sent["callback_url"], "https://api-ndc.heliosys.io")
            self.assertEqual(sent["input_data"]["callback_url"], "https://api-ndc.heliosys.io")
            self.assertEqual(sent["input_data"]["django_backend_url"], "https://api-ndc.heliosys.io")
            self.assertNotIn("_callback_url", sent["input_data"])

    @override_settings(ROBOT_WORKER_API_KEY="test-worker-secret")
    def test_worker_status_push_and_read_permissions(self):
        cache.delete(WORKER_STATUS_CACHE_KEY)

        # Unauthenticated GET is rejected
        unauth = self.client.get("/api/worker/status/")
        self.assertIn(unauth.status_code, (401, 403))

        # Regular authenticated user cannot spoof worker status via POST
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
        forbidden_post = self.client.post("/api/worker/status/", {"status": "IDLE"}, format="json")
        self.assertEqual(forbidden_post.status_code, 403)

        # Worker POST with valid X-Worker-API-Key sets BUSY with queue
        self.client.credentials(HTTP_X_WORKER_API_KEY="test-worker-secret")
        with patch("api.worker_status.broadcast_worker_status") as mock_broadcast:
            busy_resp = self.client.post(
                "/api/worker/status/",
                {"status": "BUSY", "queue_size": 2, "current_job_type": "ANTENNA"},
                format="json",
            )
            self.assertEqual(busy_resp.status_code, 200)
            data = busy_resp.json()
            self.assertEqual(data["state"], "busy")
            self.assertEqual(data["active_jobs"], 1)
            self.assertEqual(data["queue_size"], 2)
            self.assertEqual(data["total_ahead"], 3)
            self.assertTrue(mock_broadcast.called)

            # Authenticated GET reads cached state without probing the worker HTTP endpoint
            self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")
            with patch("api.worker_status.requests.get") as mock_get:
                get_resp = self.client.get("/api/worker/status/")
                self.assertEqual(get_resp.status_code, 200)
                self.assertEqual(get_resp.json()["state"], "busy")
                self.assertEqual(get_resp.json()["queue_size"], 2)
                mock_get.assert_not_called()

            # Worker transitions back to IDLE, then OFFLINE
            self.client.credentials(HTTP_X_WORKER_API_KEY="test-worker-secret")
            idle_resp = self.client.post("/api/worker/status/", {"status": "IDLE", "queue_size": 0}, format="json")
            self.assertEqual(idle_resp.status_code, 200)
            self.assertEqual(idle_resp.json()["state"], "available")
            self.assertEqual(idle_resp.json()["total_ahead"], 0)

            off_resp = self.client.post("/api/worker/status/", {"status": "OFFLINE", "queue_size": 4}, format="json")
            self.assertEqual(off_resp.status_code, 200)
            self.assertEqual(off_resp.json()["state"], "offline")
            self.assertEqual(off_resp.json()["queue_size"], 0)

    def test_worker_status_cold_start_probe_and_offline_on_dispatch_error(self):
        cache.delete(WORKER_STATUS_CACHE_KEY)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        with patch("api.worker_status.requests.get", side_effect=requests.exceptions.ConnectTimeout("timed out")) as mock_get:
            resp = self.client.get("/api/worker/status/")
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()["state"], "offline")
            mock_get.assert_called_once()

        # Seed BUSY first, then simulate dispatch failure -> flips to offline
        with patch("api.worker_status.broadcast_worker_status"):
            from api.worker_status import set_worker_status, get_cached_worker_status

            set_worker_status("BUSY", queue_size=1, source="worker")
            self.assertEqual(get_cached_worker_status()["state"], "busy")

            job = CalculationJob.objects.create(
                user=self.user,
                status="PENDING",
                input_data={"operateur": "orange"},
            )
            with patch("api.tasks.close_old_connections"), patch(
                "api.tasks.requests.post", side_effect=requests.exceptions.ConnectionError("refused")
            ):
                ok = send_job_to_worker(job.id)
                self.assertFalse(ok)
                self.assertEqual(get_cached_worker_status()["state"], "offline")