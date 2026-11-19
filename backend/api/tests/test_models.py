from django.db import IntegrityError
from django.test import TestCase
from django.contrib.auth.models import User

from api.models import CalculationJob, ClientSubscription, GeneratedSiteNdc, Role, UserProfile


class ApiModelsTest(TestCase):
    def setUp(self):
        self.role = Role.objects.create(name="Developer", description="Dev role")
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="StrongTestPassword123!",
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            phone="123-456-7890",
            department="IT",
            role=self.role,
        )

    def test_user_profile_creation(self):
        self.assertEqual(self.profile.user, self.user)
        self.assertEqual(self.profile.phone, "123-456-7890")
        self.assertEqual(self.profile.department, "IT")
        self.assertEqual(self.profile.role, self.role)
        self.assertEqual(str(self.profile), f"{self.user.username}'s Profile")

    def test_one_to_one_relationship(self):
        with self.assertRaises(IntegrityError):
            UserProfile.objects.create(user=self.user)

    def test_calculation_job_and_site_ndc_creation(self):
        sub = ClientSubscription.objects.create(user=self.user, tier="PRO", monthly_quota=100)
        self.assertIn("PRO", str(sub))

        job = CalculationJob.objects.create(
            user=self.user,
            calculation_type="antenna",
            ndc_hash="abc123",
            status="PENDING",
            input_data={"operateur": "orange"},
        )
        self.assertIn("antenna", str(job))

        ndc = GeneratedSiteNdc.objects.create(
            user=self.user,
            site_name="Paris Nord",
            code_site="SITE-001",
            operator="orange",
            pdf_url="/media/uploads/NDC_SITE_001.pdf",
        )
        self.assertIn("SITE-001", str(ndc))
