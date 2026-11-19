"""Document preview, matching catalogue PDF lookup, and catalogue debug explorer views."""
import datetime
import json
import os
import urllib.parse
from collections import Counter

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from geodata.catalogue_loader import FIXTURE_PATH, get_catalogue_files_info, load_catalogue_dict
from geodata.utils_preview import get_pdf_preview_path
from utils.path_security import safe_resolve_under


@api_view(['GET'])
@permission_classes([AllowAny])
def preview_document_api(request):
    url = request.GET.get('url')
    if not url:
        return Response({'error': 'No URL provided'}, status=400)

    if not url.startswith(settings.MEDIA_URL):
        return Response({'error': 'Invalid URL'}, status=400)

    relative_path = urllib.parse.unquote(url[len(settings.MEDIA_URL):])
    pdf_relative = get_pdf_preview_path(relative_path)

    if not pdf_relative:
        return Response({'error': 'File not found or conversion failed'}, status=404)

    return Response({'preview_url': f"{settings.MEDIA_URL}{pdf_relative}"})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_matching_catalogue_pdf(request):
    """Find the matching catalogue PDF based on montage, terrain_type, region, and height."""
    montage = request.GET.get('montage')
    terrain_type = request.GET.get('terrain_type')
    region = request.GET.get('region')
    height = request.GET.get('height')

    if not all([montage, terrain_type, region, height]):
        return Response({'error': 'Missing required parameters: montage, terrain_type, region, height'}, status=400)

    terrain_root = os.path.join(settings.MEDIA_ROOT, 'catalogue', 'terrain')
    search_dir = safe_resolve_under(terrain_root, os.path.join(f'Region_{region}', f'Terrain_{terrain_type}'))

    if not search_dir or not os.path.isdir(search_dir):
        search_dir = safe_resolve_under(terrain_root, os.path.join('Region_1', f'Terrain_{terrain_type}'))

    if not search_dir or not os.path.isdir(search_dir):
        return Response({'error': 'No matching catalogue directory found'}, status=404)

    try:
        height_float = float(height)
        height_norm = str(int(height_float)) if height_float.is_integer() else str(height_float)
    except ValueError:
        height_norm = height

    montage_normalized = montage.replace(' ', '_')
    if not montage_normalized.lower().startswith('montage'):
        montage_normalized = f"Montage_{montage_normalized}"

    matching_files = []
    try:
        for file in os.listdir(search_dir):
            file_lower = file.lower()
            if not (file_lower.endswith('.pdf') or file_lower.endswith('.docx')):
                continue
            if (f"{height_norm}m" in file_lower or f"h.{height_norm}" in file_lower) and (
                montage_normalized.lower() in file_lower or montage.lower().replace(' ', '_') in file_lower
            ):
                matching_files.append(os.path.join(search_dir, file))
    except Exception:
        pass

    if not matching_files:
        return Response(
            {
                'error': 'No matching file found for criteria',
                'criteria': {'montage': montage, 'terrain_type': terrain_type, 'region': region, 'height': height},
            },
            status=404,
        )

    config_mode = request.GET.get('config_mode', 'reference')
    if config_mode == 'agile':
        matching_files.sort(key=lambda x: 0 if 'agiles' in x.lower() else 1)
    else:
        matching_files.sort(key=lambda x: 0 if 'reelles' in x.lower() else 1)

    matched_file = matching_files[0]
    relative_path = os.path.relpath(matched_file, settings.MEDIA_ROOT)
    return Response({
        'url': f"/media/{relative_path}",
        'filename': os.path.basename(matched_file),
        'relative_path': relative_path,
        'criteria': {'montage': montage, 'terrain_type': terrain_type, 'region': region, 'height': height},
    })


@csrf_exempt
def test_catalogue_equipment_view(request):
    """Interactive & JSON catalogue explorer (loaded dynamically from fixtures)."""
    fields = load_catalogue_dict()
    modular_files = get_catalogue_files_info()

    file_metadata = {
        'relative_path': 'geodata/fixtures/catalogue_config.json',
        'file_size_kb': round(os.path.getsize(FIXTURE_PATH) / 1024, 1) if os.path.exists(FIXTURE_PATH) else 0,
        'last_modified': (
            datetime.datetime.fromtimestamp(os.path.getmtime(FIXTURE_PATH)).strftime('%d/%m/%Y %H:%M:%S')
            if os.path.exists(FIXTURE_PATH)
            else ''
        ),
        'updated_at': fields.get('updated_at', ''),
        'modular_files': modular_files,
    }

    items = []

    for ant in fields.get('real_world_references', []):
        name = ant.get('name', '')
        vendor = ant.get('vendor', '') or (name.split(' ')[0] if ' ' in name else '')
        ant4g = ant.get('ant4g', {})
        ant5g = ant.get('ant5g', {})
        specs = []
        if ant4g.get('model'):
            specs.append(f"4G: {ant4g.get('model')} ({ant4g.get('height')}×{ant4g.get('width')}×{ant4g.get('thickness')}mm, {ant4g.get('weight')}kg)")
        elif ant4g.get('height') or ant4g.get('width'):
            specs.append(f"4G: {ant4g.get('height')}×{ant4g.get('width')}×{ant4g.get('thickness')}mm, {ant4g.get('weight')}kg")
        if ant5g.get('model'):
            specs.append(f"5G: {ant5g.get('model')} ({ant5g.get('height')}×{ant5g.get('width')}×{ant5g.get('thickness')}mm, {ant5g.get('weight')}kg)")
        elif ant5g.get('height') or ant5g.get('width'):
            specs.append(f"5G: {ant5g.get('height')}×{ant5g.get('width')}×{ant5g.get('thickness')}mm, {ant5g.get('weight')}kg")
        items.append({
            'category': 'Antenne',
            'operator': (ant.get('operator') or 'all').lower().strip(),
            'id': ant.get('id', ''),
            'reference': name,
            'vendor': vendor,
            'montage_id': ant.get('montageId', ''),
            'specs': ' | '.join(specs) if specs else 'Standard',
        })

    for rru in fields.get('rru_references', []):
        vendor = rru.get('vendor', '')
        specs_parts = [p for p in [
            f"Vendeur: {vendor}" if vendor else '',
            f"Dim: {rru.get('dimensions')}" if rru.get('dimensions') else '',
            f"Poids: {rru.get('weight')}kg" if rru.get('weight') else '',
        ] if p]
        items.append({
            'category': 'RRU',
            'operator': (rru.get('operator') or 'all').lower().strip(),
            'id': rru.get('id', ''),
            'reference': rru.get('reference', ''),
            'vendor': vendor,
            'montage_id': '',
            'specs': ' | '.join(specs_parts),
        })

    for rrh in fields.get('rrh_references', []):
        vendor = rrh.get('vendor', '')
        cx_f, cx_l = rrh.get('cx_front', ''), rrh.get('cx_lat', '')
        specs_parts = [p for p in [
            f"Vendeur: {vendor}" if vendor else '',
            f"Dim: {rrh.get('dimensions')}" if rrh.get('dimensions') else '',
            f"Poids: {rrh.get('weight')}kg" if rrh.get('weight') else '',
            f"Cx (F/L): {cx_f}/{cx_l}" if (cx_f is not None and cx_l is not None and cx_f != '') else '',
        ] if p]
        items.append({
            'category': 'RRH',
            'operator': (rrh.get('operator') or 'all').lower().strip(),
            'id': rrh.get('id', ''),
            'reference': rrh.get('reference', ''),
            'vendor': vendor,
            'montage_id': '',
            'specs': ' | '.join(specs_parts),
        })

    for coff in fields.get('coffret_references', []):
        items.append({
            'category': 'Coffret',
            'operator': (coff.get('operator') or 'all').lower().strip(),
            'id': coff.get('id', ''),
            'reference': coff.get('name', ''),
            'vendor': coff.get('vendor', ''),
            'montage_id': '',
            'specs': coff.get('name', ''),
        })

    for fh in fields.get('fh_references', []):
        items.append({
            'category': 'FH',
            'operator': (fh.get('operator') or 'all').lower().strip(),
            'id': fh.get('id', ''),
            'reference': fh.get('reference') or fh.get('name', ''),
            'vendor': fh.get('vendor', ''),
            'montage_id': '',
            'specs': f"Diamètre: {fh.get('diameter', 0)} mm | Poids: {fh.get('weight', 0)} kg",
        })

    for td in fields.get('td_references', []):
        op = (td.get('operator') or 'free').lower().strip()
        items.append({
            'category': 'TD',
            'operator': op,
            'id': td.get('id', ''),
            'reference': td.get('name') or td.get('reference', ''),
            'vendor': td.get('vendor', '') or ('FREE' if op == 'free' else ''),
            'montage_id': '',
            'specs': f"Dim: {td.get('dimensions', 'N/A')} | Poids: {td.get('weight', 0)} kg",
        })

    for tgbt in fields.get('tgbt_references', []):
        items.append({
            'category': 'TGBT',
            'operator': (tgbt.get('operator') or 'all').lower().strip(),
            'id': tgbt.get('id', ''),
            'reference': tgbt.get('name') or tgbt.get('reference', ''),
            'vendor': tgbt.get('vendor', '') or tgbt.get('supplier', ''),
            'montage_id': '',
            'specs': f"Dim: {tgbt.get('dimensions', 'N/A')} | Poids: {tgbt.get('weight', 0)} kg",
        })

    for baie in fields.get('baie_references', []):
        specs_p = [p for p in [
            f"Dim: {baie.get('dimensions')}" if baie.get('dimensions') else '',
            f"Poids: {baie.get('weight')}kg" if baie.get('weight') else '',
            f"Type: {baie.get('category_label')}" if baie.get('category_label') else '',
        ] if p]
        items.append({
            'category': 'Baie',
            'operator': (baie.get('operator') or 'all').lower().strip(),
            'id': baie.get('id', ''),
            'reference': baie.get('name') or baie.get('reference', ''),
            'vendor': baie.get('vendor', ''),
            'montage_id': '',
            'specs': ' | '.join(specs_p) if specs_p else 'Baie standard',
        })

    for at in fields.get('atelier_energie_references', []):
        specs_p = [p for p in [
            f"Dim: {at.get('dimensions')}" if at.get('dimensions') else '',
            f"Poids: {at.get('weight')}kg" if at.get('weight') else '',
            f"Cat: {at.get('category')}" if at.get('category') else '',
        ] if p]
        items.append({
            'category': 'Atelier Énergie',
            'operator': (at.get('operator') or 'free').lower().strip(),
            'id': at.get('id', ''),
            'reference': at.get('name') or at.get('reference', ''),
            'vendor': at.get('vendor', ''),
            'montage_id': '',
            'specs': ' | '.join(specs_p) if specs_p else 'Module énergie',
        })

    for m in fields.get('standard_montages', []):
        items.append({
            'category': 'Montage Standard',
            'operator': (m.get('operator') or 'all').lower().strip(),
            'id': m.get('id', ''),
            'reference': m.get('name', ''),
            'vendor': '',
            'montage_id': m.get('id', ''),
            'specs': f"Abréviation: {m.get('abbreviation', '')}",
        })

    operators = ['orange', 'bouygues', 'free', 'sfr', 'all']
    stats_by_operator = {}
    for op in operators:
        op_items = [i for i in items if i['operator'] == op]
        cat_counts = Counter(i['category'] for i in op_items)
        stats_by_operator[op] = {
            'total': len(op_items),
            'antennes': cat_counts.get('Antenne', 0),
            'rru': cat_counts.get('RRU', 0),
            'rrh': cat_counts.get('RRH', 0),
            'baies': cat_counts.get('Baie', 0),
            'atelier_energie': cat_counts.get('Atelier Énergie', 0),
            'coffrets': cat_counts.get('Coffret', 0),
            'fh': cat_counts.get('FH', 0),
            'td': cat_counts.get('TD', 0),
            'tgbt': cat_counts.get('TGBT', 0),
            'montages': cat_counts.get('Montage Standard', 0),
            'categories': dict(cat_counts),
        }

    stats_by_category = Counter(i['category'] for i in items)
    vendors_list = sorted({i['vendor'] for i in items if i['vendor']})

    if request.GET.get('format') == 'json' or 'application/json' in request.META.get('HTTP_ACCEPT', ''):
        return JsonResponse({
            'file_metadata': file_metadata,
            'total_count': len(items),
            'stats_by_operator': stats_by_operator,
            'stats_by_category': dict(stats_by_category),
            'vendors': vendors_list,
            'items': items,
        }, json_dumps_params={'indent': 2})

    return render(request, 'test_catalogue.html', {
        'file_metadata': file_metadata,
        'total_count': len(items),
        'items_json': json.dumps(items),
        'stats_by_operator': stats_by_operator,
        'stats_by_category': dict(stats_by_category),
        'vendors_list': vendors_list,
    })

