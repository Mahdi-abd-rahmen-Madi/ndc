import os
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch

from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from api.models import CalculationJob, PdfGenerationTask
from geodata.terrain import repository, service
from utils.libreoffice import convert_to_pdf
from utils.ws_hub import publish_ws_event


class WsHubAndGotenbergUnitTest(SimpleTestCase):
    @override_settings(WS_HUB_URL="http://ws-hub:8081", WS_HUB_SECRET="hub-secret-123")
    def test_publish_ws_event_uses_go_hub_when_configured(self):
        with patch("utils.ws_hub._HUB_SESSION.post") as mock_post:
            mock_post.return_value.status_code = 200
            ok = publish_ws_event(
                "calc_42",
                {"job_id": 42, "percent": 50},
                channel_event={"type": "calc_progress", "data": {"job_id": 42, "percent": 50}},
            )
            self.assertTrue(ok)
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            self.assertEqual(call_args[0][0], "http://ws-hub:8081/internal/publish")
            self.assertEqual(call_args.kwargs["headers"]["X-Hub-Secret"], "hub-secret-123")
            self.assertEqual(call_args.kwargs["json"]["group"], "calc_42")
            self.assertEqual(call_args.kwargs["json"]["payload"]["percent"], 50)

    @override_settings(WS_HUB_URL="")
    def test_publish_ws_event_falls_back_to_channels(self):
        fake_layer = MagicMock()
        fake_layer.group_send = AsyncMock()
        with patch("channels.layers.get_channel_layer", return_value=fake_layer):
            ok = publish_ws_event(
                "worker_status",
                {"type": "worker_status", "state": "available"},
                channel_event={"type": "worker_status_update", "data": {"state": "available"}},
            )
            self.assertTrue(ok)
            fake_layer.group_send.assert_awaited_once()

    @override_settings(GOTENBERG_URL="http://gotenberg:3000")
    def test_convert_to_pdf_uses_gotenberg_when_configured(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            src_path = os.path.join(tmpdir, "sample.rtf")
            out_dir = os.path.join(tmpdir, "out")
            with open(src_path, "wb") as fh:
                fh.write(b"{\\rtf1 hello}")

            fake_resp = MagicMock()
            fake_resp.content = b"%PDF-1.4 mock"
            fake_resp.raise_for_status = MagicMock()

            with patch("utils.libreoffice._GOTENBERG_SESSION.post", return_value=fake_resp) as mock_post, \
                 patch("utils.libreoffice.subprocess.run") as mock_subproc:
                produced = convert_to_pdf([src_path], out_dir, timeout=45)

            mock_post.assert_called_once()
            self.assertEqual(mock_post.call_args[0][0], "http://gotenberg:3000/forms/libreoffice/convert")
            mock_subproc.assert_not_called()
            self.assertEqual(len(produced), 1)
            self.assertTrue(produced[0].endswith("sample.pdf"))
            with open(produced[0], "rb") as pdf_fh:
                self.assertEqual(pdf_fh.read(), b"%PDF-1.4 mock")


class RepositorySqlPushdownUnitTest(SimpleTestCase):
    def test_sql_pushdowns_use_django_connection_cursor(self):
        fake_cursor = MagicMock()
        fake_cursor.__enter__ = MagicMock(return_value=fake_cursor)
        fake_cursor.__exit__ = MagicMock(return_value=False)

        fake_conn = MagicMock()
        fake_conn.cursor.return_value = fake_cursor

        with patch("geodata.terrain.repository._is_sqlite_backend", return_value=False), \
             patch("geodata.terrain.repository.connection", fake_conn):
            fake_cursor.fetchall.return_value = [("111", 750.0), ("211", 250.0)]
            areas = repository.query_spatial_extent_code_areas_sql(2.35, 48.85, radius_km=2.0)
            self.assertEqual(areas, {"111": 750.0, "211": 250.0})

            fake_cursor.fetchone.return_value = (26.0,)
            vb0 = repository.query_wind_vb0_sql(2.35, 48.85)
            self.assertEqual(vb0, 26.0)

            fake_cursor.fetchone.return_value = (True,)
            near = repository.is_point_near_coastline_sql(-1.5, 47.2, threshold_km=1.0)
            self.assertTrue(near)

    def test_terrain_service_prefers_sql_for_region_and_coastline(self):
        ts = service.TerrainClassificationService.get_instance()
        with patch("geodata.terrain.service.query_wind_vb0_sql", return_value=26), \
             patch.object(ts, "_load_wind_coeff_data") as mock_load_wind:
            region = ts.get_region_from_coordinates(2.35, 48.85)
            self.assertEqual(region, 3)
            mock_load_wind.assert_not_called()

        with patch("geodata.terrain.service.is_point_near_coastline_sql", return_value=True), \
             patch.object(ts, "_load_coastline_data") as mock_load_coast:
            self.assertTrue(ts._is_near_physical_coastline(-4.48, 48.39))
            mock_load_coast.assert_not_called()


class AsyncPdfGenerationApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="eng@example.com",
            email="eng@example.com",
            password="StrongPassword123!",
        )
        self.other = User.objects.create_user(
            username="other@example.com",
            email="other@example.com",
            password="StrongPassword123!",
        )
        self.token = Token.objects.create(user=self.user)
        self.other_token = Token.objects.create(user=self.other)

    @override_settings(ASYNC_PDF_GENERATION=True)
    def test_generate_site_ndc_async_returns_202_and_polls_with_ownership_guard(self):
        job = CalculationJob.objects.create(
            user=self.user,
            status="COMPLETED",
            input_data={"operateur": "orange"},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        with patch("api.services.validate_calculation_artifacts", return_value=[]), \
             patch("api.views.enqueue_task") as mock_enqueue, \
             self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(
                "/api/calculations/generate_site_ndc/",
                {"job_ids": [job.id], "site_name": "Test Site"},
                format="json",
            )

        self.assertEqual(resp.status_code, 202)
        task_id = resp.json()["task_id"]
        self.assertEqual(resp.json()["status"], "PENDING")
        mock_enqueue.assert_called_once()
        self.assertEqual(mock_enqueue.call_args[0][0], "api.tasks.generate_site_ndc_task")

        PdfGenerationTask.objects.filter(id=task_id).update(
            status="COMPLETED",
            pdf_url="/media/uploads/SITE_NDC_test.pdf",
        )

        status_resp = self.client.get(f"/api/calculations/pdf-tasks/{task_id}/")
        self.assertEqual(status_resp.status_code, 200)
        self.assertEqual(status_resp.json()["status"], "COMPLETED")
        self.assertEqual(status_resp.json()["ndc_pdf_url"], "/media/uploads/SITE_NDC_test.pdf")

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.other_token.key}")
        forbidden = self.client.get(f"/api/calculations/pdf-tasks/{task_id}/")
        self.assertEqual(forbidden.status_code, 403)
