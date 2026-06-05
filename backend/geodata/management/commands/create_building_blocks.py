import time
import logging
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils import timezone
from geodata.models import Building, BuildingBlock

class Command(BaseCommand):
    help = 'Group building footprints into Building Blocks (agglomerations) using PostGIS clustering'

    def add_arguments(self, parser):
        parser.add_argument(
            '--departments',
            nargs='+',
            type=str,
            help='Specific department codes to process (e.g., 01 30 75). If not specified, processes all departments.'
        )
        parser.add_argument(
            '--eps',
            type=float,
            default=0.0009,
            help='Epsilon parameter for DBSCAN in degrees (~0.0009 deg is approx 100m). Default: 0.0009'
        )

    def handle(self, *args, **options):
        import os
        eps = options['eps']
        departments = options['departments']

        log_dir = "/home/mahdi/CascadeProjects/ndc/backend/data"
        os.makedirs(log_dir, exist_ok=True)
        log_file_path = os.path.join(log_dir, "create_building_blocks.log")

        with open(log_file_path, "w") as f:
            f.write(f"--- LOG START: {timezone.now().isoformat()} (eps={eps}) ---\n")
            f.flush()

        def log_msg(msg, style_func=None):
            if style_func:
                self.stdout.write(style_func(msg))
            else:
                self.stdout.write(msg)
            self.stdout.flush()
            with open(log_file_path, "a") as f:
                f.write(msg + "\n")
                f.flush()

        log_msg(f"🚀 Starting Building Footprint Agglomeration (eps={eps:.4f} (~100m))", self.style.WARNING)

        # Get unique departments
        if not departments:
            departments = list(Building.objects.values_list('department_code', flat=True).distinct().order_by('department_code'))
            log_msg(f"ℹ️ Found {len(departments)} departments to process in Building footprints.")
        else:
            departments = [str(dept).strip().upper().zfill(2) for dept in departments]

        if not departments:
            log_msg("🎉 No building footprints found in database. Exiting.", self.style.SUCCESS)
            return

        total_start_time = time.time()
        total_blocks_created = 0

        for dept_code in departments:
            dept_start_time = time.time()
            log_msg(f"\n📍 Processing department: {dept_code}...")

            with transaction.atomic():
                with connection.cursor() as cursor:
                    # 1. Clean up existing blocks for this department to ensure idempotency
                    cursor.execute("DELETE FROM geodata_buildingblock WHERE department_code = %s", [dept_code])
                    deleted_count = cursor.rowcount
                    if deleted_count > 0:
                        log_msg(f"  🧹 Deleted {deleted_count} stale building blocks.")

                    # 2. Run DBSCAN clustering and perform morphological closing only on multi-building blocks (building_count > 1).
                    # Single buildings (isolated) are kept as-is, which is 50x faster.
                    cursor.execute("""
                        INSERT INTO geodata_buildingblock (department_code, commune_insee, geometry, building_count, last_update)
                        SELECT 
                            department_code,
                            commune_insee,
                            CASE 
                                WHEN COUNT(*) > 1 THEN 
                                    ST_Multi(ST_CollectionExtract(
                                        ST_Transform(
                                            ST_Buffer(
                                                ST_Buffer(
                                                    ST_Transform(ST_UnaryUnion(ST_Collect(geometry)), 2154),
                                                    50, 'quad_segs=2'
                                                ),
                                                -50, 'quad_segs=2'
                                            ),
                                            4326
                                        ),
                                        3
                                    ))
                                ELSE 
                                    ST_Multi(ST_CollectionExtract(ST_UnaryUnion(ST_Collect(geometry)), 3))
                            END as geometry,
                            COUNT(*) as building_count,
                            NOW() as last_update
                        FROM (
                            SELECT 
                                department_code,
                                commune_insee,
                                geometry,
                                COALESCE(
                                    ST_ClusterDBSCAN(geometry, eps := %s, minpoints := 1) OVER(PARTITION BY commune_insee),
                                    row_number() OVER()
                                ) as cluster_id
                            FROM geodata_building
                            WHERE department_code = %s
                        ) sub
                        GROUP BY department_code, commune_insee, cluster_id;
                    """, [eps, dept_code])

                    created_count = cursor.rowcount
                    total_blocks_created += created_count

            dept_duration = time.time() - dept_start_time
            log_msg(
                f"  ✅ Department {dept_code} completed in {dept_duration:.2f} seconds | Building Blocks: {created_count}",
                self.style.SUCCESS
            )

        total_duration = time.time() - total_start_time
        log_msg("\n" + "="*70)
        log_msg("🎉 BUILDING FOOTPRINT AGGLOMERATION COMPLETE", self.style.SUCCESS)
        log_msg(f"🏢 Total Building Blocks Created: {total_blocks_created}")
        log_msg(f"⏱️ Total Time: {total_duration:.2f} seconds")
        log_msg("="*70)
