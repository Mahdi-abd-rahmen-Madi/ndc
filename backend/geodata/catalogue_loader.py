import os
import json
import copy
import datetime
import threading
from django.conf import settings
from utils.domain_constants import normalize_operator

CATALOGUE_DIR = os.path.join(settings.BASE_DIR, 'geodata', 'fixtures', 'catalogue')
FIXTURE_PATH = os.path.join(settings.BASE_DIR, 'geodata', 'fixtures', 'catalogue_config.json')
ALL_GEODATA_PATH = os.path.join(settings.BASE_DIR, 'geodata', 'fixtures', 'all_geodata.json')

FILE_MAPPING = {
    'antennas': 'antennas.json',
    'rrh': 'rrh.json',
    'rru': 'rru.json',
    'td': 'td.json',
    'tgbt': 'tgbt.json',
    'fh': 'fh.json',
    'coffrets': 'coffrets.json',
    'atelier_energie': 'atelier_energie.json',
    'baies': 'baies.json',
    'standards': 'standards.json',
}

# Thread-safe mtime-keyed cache so repeated catalogue lookups don't re-parse JSON from disk
_CACHE_LOCK = threading.Lock()
_RAW_FILE_CACHE = {}  # filename -> (mtime, parsed_data)
_CATALOGUE_CACHE = None  # (mtimes_tuple, catalogue_dict)


def clear_catalogue_cache():
    """Explicitly invalidate the in-memory catalogue JSON cache."""
    global _CATALOGUE_CACHE
    with _CACHE_LOCK:
        _RAW_FILE_CACHE.clear()
        _CATALOGUE_CACHE = None


def load_raw_file(filename: str):
    """Load JSON from a specific catalogue file with mtime-based in-memory caching."""
    path = os.path.join(CATALOGUE_DIR, filename)
    if not os.path.exists(path):
        return None
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return None

    with _CACHE_LOCK:
        cached = _RAW_FILE_CACHE.get(filename)
        if cached is not None and cached[0] == mtime:
            return cached[1]

    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    with _CACHE_LOCK:
        _RAW_FILE_CACHE[filename] = (mtime, data)
    return data


def load_catalogue_dict() -> dict:
    """
    Assemble the complete catalogue configuration from individual dedicated JSON files
    with mtime-validated in-memory caching.
    """
    global _CATALOGUE_CACHE
    mtimes = []
    for filename in FILE_MAPPING.values():
        path = os.path.join(CATALOGUE_DIR, filename)
        mtimes.append(os.path.getmtime(path) if os.path.exists(path) else None)
    mtimes_key = tuple(mtimes)

    with _CACHE_LOCK:
        if _CATALOGUE_CACHE is not None and _CATALOGUE_CACHE[0] == mtimes_key:
            return copy.deepcopy(_CATALOGUE_CACHE[1])

    standards = load_raw_file(FILE_MAPPING['standards']) or {}
    
    catalogue = {
        'precalculated_building_heights': standards.get('precalculated_building_heights', [10, 15, 20, 25, 30, 35, 40, 45]),
        'recommended_mast_heights': standards.get('recommended_mast_heights', [3, 4]),
        'fh_weight_options': standards.get('fh_weight_options', [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]),
        'standard_montages': standards.get('standard_montages', []),
        'real_world_references': load_raw_file(FILE_MAPPING['antennas']) or [],
        'coffret_references': load_raw_file(FILE_MAPPING['coffrets']) or [],
        'fh_references': load_raw_file(FILE_MAPPING['fh']) or [],
        'td_references': load_raw_file(FILE_MAPPING['td']) or [],
        'tgbt_references': load_raw_file(FILE_MAPPING['tgbt']) or [],
        'rru_references': load_raw_file(FILE_MAPPING['rru']) or [],
        'rrh_references': load_raw_file(FILE_MAPPING['rrh']) or [],
        'atelier_energie_references': load_raw_file(FILE_MAPPING['atelier_energie']) or [],
        'baie_references': load_raw_file(FILE_MAPPING['baies']) or [],
        'wind_calculation_rules': standards.get('wind_calculation_rules', {
            'cscd': 1.0,
            'fw_formula': 'cscd * cf * qp(z) * Are',
            'surf_front_formula': 'height * width',
            'surf_lat_formula': 'height * thickness',
            'description': 'Calcul des efforts de vent selon NF EN 1991-1-4 (EC1)'
        }),
        'bouygues_antennas': standards.get('bouygues_antennas', []),
        'free_antennas': standards.get('free_antennas', []),
        'orange_antennas': standards.get('orange_antennas', []),
        'updated_at': datetime.datetime.utcnow().isoformat() + 'Z'
    }
    with _CACHE_LOCK:
        _CATALOGUE_CACHE = (mtimes_key, catalogue)
    return copy.deepcopy(catalogue)


def get_catalogue_files_info() -> list:
    """
    Return metadata for each modular catalogue file (name, size, item count, modified time).
    """
    files_info = []
    category_labels = {
        'antennas.json': ('Antennes 4G / 5G', 'real_world_references'),
        'rrh.json': ('RRH (Remote Radio Head)', 'rrh_references'),
        'rru.json': ('RRU (Remote Radio Unit)', 'rru_references'),
        'td.json': ('Tableaux de Distribution (TD)', 'td_references'),
        'tgbt.json': ('Tableaux Généraux Basse Tension (TGBT)', 'tgbt_references'),
        'fh.json': ('Faisceaux Hertziens (FH)', 'fh_references'),
        'coffrets.json': ('Coffrets (Hybrides, FO, HTTA)', 'coffret_references'),
        'atelier_energie.json': ('Atelier d\'Énergie', 'atelier_energie_references'),
        'baies.json': ('Baies Télécom', 'baie_references'),
        'standards.json': ('Montages & Hauteurs Standards', 'standard_montages'),
    }

    for filename, (label, field_key) in category_labels.items():
        filepath = os.path.join(CATALOGUE_DIR, filename)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                if isinstance(content, list):
                    count = len(content)
                elif isinstance(content, dict):
                    count = len(content.get(field_key, [])) if field_key in content else len(content.keys())
                else:
                    count = 0
            except Exception:
                count = 0

            files_info.append({
                'filename': filename,
                'relative_path': f'geodata/fixtures/catalogue/{filename}',
                'category': label,
                'item_count': count,
                'file_size_kb': round(os.path.getsize(filepath) / 1024, 1),
                'last_modified': datetime.datetime.fromtimestamp(os.path.getmtime(filepath)).strftime('%d/%m/%Y %H:%M:%S')
            })
    return files_info


def sync_catalogue_to_db(save_fixtures: bool = True):
    """
    Sync all split configuration files to:
    1. The Django database singleton CatalogueConfig (pk=1)
    2. The combined Django fixture catalogue_config.json
    3. all_geodata.json
    """
    from geodata.models import CatalogueConfig

    catalogue = load_catalogue_dict()
    
    # 1. Update DB singleton
    config, _ = CatalogueConfig.objects.get_or_create(pk=1)
    config.precalculated_building_heights = catalogue['precalculated_building_heights']
    config.recommended_mast_heights = catalogue['recommended_mast_heights']
    config.fh_weight_options = catalogue['fh_weight_options']
    config.standard_montages = catalogue['standard_montages']
    config.real_world_references = catalogue['real_world_references']
    config.coffret_references = catalogue['coffret_references']
    config.fh_references = catalogue['fh_references']
    config.td_references = catalogue['td_references']
    config.tgbt_references = catalogue['tgbt_references']
    config.rru_references = catalogue['rru_references']
    config.rrh_references = catalogue['rrh_references']
    config.atelier_energie_references = catalogue['atelier_energie_references']
    config.baie_references = catalogue['baie_references']
    config.save()

    # 2. Update combined fixture catalogue_config.json (strictly valid Django model fields)
    if save_fixtures:
        model_field_names = {
            f.name for f in CatalogueConfig._meta.fields if f.name not in ('id', 'pk')
        }
        fixture_fields = {k: v for k, v in catalogue.items() if k in model_field_names}
        fixture_payload = [
            {
                "model": "geodata.catalogueconfig",
                "pk": 1,
                "fields": fixture_fields
            }
        ]
        with open(FIXTURE_PATH, 'w', encoding='utf-8') as f:
            json.dump(fixture_payload, f, indent=2, ensure_ascii=False)

        # 3. Update all_geodata.json if it exists
        if os.path.exists(ALL_GEODATA_PATH):
            try:
                with open(ALL_GEODATA_PATH, 'r', encoding='utf-8') as f:
                    all_data = json.load(f)

                found = False
                for item in all_data:
                    if item.get('model') == 'geodata.catalogueconfig' and item.get('pk') == 1:
                        item['fields'] = fixture_fields
                        found = True
                        break

                if not found:
                    all_data.append({
                        "model": "geodata.catalogueconfig",
                        "pk": 1,
                        "fields": fixture_fields
                    })

                with open(ALL_GEODATA_PATH, 'w', encoding='utf-8') as f:
                    json.dump(all_data, f, indent=2, ensure_ascii=False)
            except Exception as e:
                print(f"Warning: Failed to update all_geodata.json: {e}")

    return catalogue


def find_equipment_reference(kind: str, identifier_or_ref: str, operator: str = None) -> dict:
    """
    Unified 3-tier catalogue reference lookup (exact ID -> exact ref/short_ref/name -> partial)
    backed by mtime-cached JSON data. Supports any list-based category in FILE_MAPPING (`rrh`, `rru`, etc.).
    """
    filename = FILE_MAPPING.get(kind)
    if not filename:
        return None
    items = load_raw_file(filename) or []
    query = (identifier_or_ref or '').strip().lower()
    if not query:
        return None
    norm_op = normalize_operator(operator) if operator else ''

    def _op_matches(item: dict) -> bool:
        if not norm_op:
            return True
        return normalize_operator(item.get('operator')) == norm_op

    # 1. Exact ID match
    for item in items:
        if (item.get('id') or '').lower() == query and _op_matches(item):
            return item

    # 2. Exact reference, short_reference, or name match
    for item in items:
        candidates = (
            (item.get('reference') or '').lower(),
            (item.get('short_reference') or '').lower(),
            (item.get('name') or '').lower(),
        )
        if query in candidates and _op_matches(item):
            return item

    # 3. Partial match on reference or short_reference
    for item in items:
        ref = (item.get('reference') or '').lower()
        short_ref = (item.get('short_reference') or '').lower()
        if ((ref and (query in ref or ref in query)) or (short_ref and (query in short_ref or short_ref in query))) and _op_matches(item):
            return item

    return None


def find_rrh_reference(identifier_or_ref: str, operator: str = None) -> dict:
    """Search for an RRH reference in rrh.json by ID, reference, or name."""
    return find_equipment_reference('rrh', identifier_or_ref, operator=operator)


def find_rru_reference(identifier_or_ref: str, operator: str = None) -> dict:
    """Search for an RRU reference in rru.json by ID, reference, or name."""
    return find_equipment_reference('rru', identifier_or_ref, operator=operator)

