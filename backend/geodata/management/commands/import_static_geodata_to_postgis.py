import json
import os
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection, transaction


class Command(BaseCommand):
    help = (
        "Import ec1_windCoeff.geojson and france_coastline.geojson into PostGIS "
        "(ec1_wind_coeff & france_coastline) with GiST indexes so multi-worker "
        "Gunicorn processes avoid loading GeoDataFrames into per-worker RAM."
    )

    def handle(self, *args, **options):
        db_engine = settings.DATABASES.get("default", {}).get("ENGINE", "")
        if "sqlite" in db_engine:
            self.stderr.write(self.style.ERROR("PostGIS is required for import_static_geodata_to_postgis."))
            return

        wind_path = os.path.join(settings.BASE_DIR, "data", "ec1_windCoeff.geojson")
        coast_path = os.path.join(settings.BASE_DIR, "data", "france_coastline.geojson")

        if os.path.isfile(wind_path):
            self._import_wind_coeff(wind_path)
        else:
            self.stderr.write(self.style.WARNING(f"Missing wind file: {wind_path}"))

        if os.path.isfile(coast_path):
            self._import_coastline(coast_path)
        else:
            self.stderr.write(self.style.WARNING(f"Missing coastline file: {coast_path}"))

    def _import_wind_coeff(self, path: str):
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        features = data.get("features", [])
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS ec1_wind_coeff (
                        id SERIAL PRIMARY KEY,
                        v_b0 DOUBLE PRECISION NOT NULL,
                        geometry geometry(Geometry, 4326) NOT NULL
                    );
                """)
                cursor.execute("TRUNCATE TABLE ec1_wind_coeff RESTART IDENTITY;")
                for feat in features:
                    props = feat.get("properties") or {}
                    geom = feat.get("geometry")
                    vb0 = props.get("V_B0")
                    if vb0 is None or not geom:
                        continue
                    cursor.execute(
                        "INSERT INTO ec1_wind_coeff (v_b0, geometry) "
                        "VALUES (%s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))",
                        [float(vb0), json.dumps(geom)],
                    )
                cursor.execute(
                    "CREATE INDEX IF NOT EXISTS ec1_wind_coeff_geom_idx "
                    "ON ec1_wind_coeff USING GIST (geometry);"
                )
        self.stdout.write(self.style.SUCCESS(f"Imported {len(features)} wind features into ec1_wind_coeff."))

    def _import_coastline(self, path: str):
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        features = data.get("features", [])
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS france_coastline (
                        id SERIAL PRIMARY KEY,
                        geometry geometry(Geometry, 4326) NOT NULL
                    );
                """)
                cursor.execute("TRUNCATE TABLE france_coastline RESTART IDENTITY;")
                for feat in features:
                    geom = feat.get("geometry")
                    if not geom:
                        continue
                    cursor.execute(
                        "INSERT INTO france_coastline (geometry) "
                        "VALUES (ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))",
                        [json.dumps(geom)],
                    )
                cursor.execute(
                    "CREATE INDEX IF NOT EXISTS france_coastline_geom_2154_idx "
                    "ON france_coastline USING GIST (ST_Transform(geometry, 2154));"
                )
        self.stdout.write(self.style.SUCCESS(f"Imported {len(features)} coastline features into france_coastline."))
