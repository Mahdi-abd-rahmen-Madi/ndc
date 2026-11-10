import os
import sys
import django

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from api.services import extract_ndc_context, _populate_rrh_docx
from geodata.ndc_generator import extract_rrh_ndc_context
from django.template.loader import render_to_string
import docx

def run_tests():
    print("=" * 70)
    print("RUNNING MULTI-RRH NDC EXTRACTION & RENDERING VERIFICATION TESTS")
    print("=" * 70)

    # 1. Benchmark worker payload (Job 537 scenario)
    sample_result_data = {
        "calculation_type": "rrh",
        "rrh_items": [
            {
                "index": 1,
                "name": "RRH AHHB 2600",
                "catalog_reference": "AHHB 2600",
                "qty": 1,
                "h_mm": 337.0,
                "w_mm": 295.0,
                "t_mm": 141.0,
                "dimensions_str": "337 x 295 x 141",
                "weight_kg": 15.7,
                "weight_total_kg": 15.7,
                "cf_front": 1.36,
                "cf_lat": 1.10,
                "a_front": 0.10,
                "a_lat": 0.05,
                "fw_front": 16.81,
                "fw_lat": 6.80,
                "pe_dan": 15.7,
                "fw_front_formula": "1 * 1.36 * 0.10 * 123.57 = 16.81 daN",
                "fw_lat_formula": "1 * 1.10 * 0.05 * 123.57 = 6.80 daN",
            },
            {
                "index": 2,
                "name": "RRH AHDA 900",
                "catalog_reference": "AHDA 900",
                "qty": 1,
                "h_mm": 336.0,
                "w_mm": 309.0,
                "t_mm": 130.0,
                "dimensions_str": "336 x 309 x 130",
                "weight_kg": 14.0,
                "weight_total_kg": 14.0,
                "cf_front": 1.32,
                "cf_lat": 1.12,
                "a_front": 0.11,
                "a_lat": 0.05,
                "fw_front": 17.94,
                "fw_lat": 6.92,
                "pe_dan": 14.0,
                "fw_front_formula": "1 * 1.32 * 0.11 * 123.57 = 17.94 daN",
                "fw_lat_formula": "1 * 1.12 * 0.05 * 123.57 = 6.92 daN",
            }
        ],
        "rrh_totals": {
            "count": 2,
            "qty_total": 2,
            "fw_front": 34.75,
            "fw_lat": 13.72,
            "pe_dan": 29.70,
            "weight_total_kg": 29.70,
            "fw_front_formula": "16.81 + 17.94 = 34.75 daN",
            "fw_lat_formula": "6.80 + 6.92 = 13.72 daN",
        },
        "wind_params": {
            "region": 2,
            "terrain_type": "IIIa",
            "building_height_m": 0.0,
            "v_b0": 26.0,
            "kr": 0.19,
            "cr": 1.25,
            "vm": 32.48,
            "iv": 0.15,
            "qp_dan": 123.57,
            "fw_front": 34.75,
            "fw_lat": 13.72,
            "fw_mast": 10.87,
            "cf_mast": 1.0,
        },
        "structure_params": {
            "mast_section": "TRON 88x3.2",
            "mast_d_m": 0.088,
            "mast_t_m": 0.0032,
            "hauteur_mat_m": 1.5,
            "plot_section": "TCAR 200x5",
            "plot_h_m": 0.5,
        },
        "extremes": {
            "fx_max": 34.75,
            "fz_max": -29.70,
        }
    }

    class MockJob:
        id = 9999
        result_data = sample_result_data
        input_data = {
            "is_rrh": True,
            "rrh_equipment": {"enabled": True},
            "environment": {"region": 2, "terrain_type": "IIIa", "building_height_m": 0.0, "v_b0": 26.0},
            "structure": {"mat_principal": "TRON 88x3.2", "mast_height_m": 1.5}
        }
        calculation_type = "rrh"
        rrh_screenshot = None
        rrh_tableau_charges = None
        rrh_verification_screenshot = None
        note_de_calcul_rrh = None
        note_mat = None
        note_plot = None
        rrh_assemblage_note = None

    # --- Test 1: Context Extraction ---
    ctx = extract_ndc_context(MockJob())
    assert len(ctx["items"]) == 2, f"Expected 2 items, got {len(ctx['items'])}"
    assert ctx["wind"]["qp_dan"] == 123.57
    assert ctx["wind"]["fw_mast"] == 10.87
    assert ctx["items"][0]["fw_front"] == 16.81
    assert ctx["items"][1]["fw_front"] == 17.94
    print("[PASS] Test 1: extract_ndc_context extracted authoritative worker values.")

    rrh_ctx = extract_rrh_ndc_context(sample_result_data)
    assert len(rrh_ctx["items"]) == 2
    assert rrh_ctx["structure"]["mast_d_m"] == 0.088
    assert rrh_ctx["wind"]["qp_dan"] == 123.57
    print("[PASS] Test 2: extract_rrh_ndc_context in geodata extracted structure & wind correctly.")

    # --- Test 2: DOCX Assembly & Text Population ---
    template_path = os.path.join(django.conf.settings.BASE_DIR, "templates", "rrh", "NDC RRH-1.docx")
    assert os.path.exists(template_path), f"Template not found at {template_path}"
    doc = docx.Document(template_path)
    _populate_rrh_docx(doc, ctx)

    # Check Table 0 rows
    table0 = doc.tables[0]
    row_texts = [[c.text.strip() for c in r.cells] for r in table0.rows]
    print(f"DOCX Table 0 rows ({len(table0.rows)}):", row_texts)
    assert len(table0.rows) == 3, f"Expected 3 rows (header + 2 RRHs), got {len(table0.rows)}"
    assert row_texts[1][0] == "RRH AHHB 2600"
    assert row_texts[1][1] == "1"
    assert row_texts[1][3] == "15.7"
    assert row_texts[2][0] == "RRH AHDA 900"
    assert row_texts[2][1] == "1"
    assert row_texts[2][3] == "14.0"
    # Ensure NO "Total" row exists
    for r in row_texts:
        assert r[0] != "Total", "Found unexpected 'Total' row in Table 0!"
    print("[PASS] Test 3: DOCX Table 0 populated with items and without Total row.")

    # Check wind paragraphs
    full_doc_text = "\n".join(p.text for p in doc.paragraphs)
    assert "Région 2" in full_doc_text
    assert "Catégorie de terrain : IIIa" in full_doc_text
    assert "qp = 123.57 daN/m²" in full_doc_text
    assert "Mât : Fw = 1 * 1 * 0.088 * 123.57 = 10.87 daN/ml" in full_doc_text
    assert "RRH #1 (RRH AHHB 2600) : Fw,Frontale = 1 * 1.36 * 0.10 * 123.57 = 16.81 daN" in full_doc_text
    assert "RRH #2 (RRH AHDA 900) : Fw,Frontale = 1 * 1.32 * 0.11 * 123.57 = 17.94 daN" in full_doc_text
    # Ensure NO TOTAL RRH summary lines
    assert "TOTAL RRH : Fw" not in full_doc_text, "Found unexpected 'TOTAL RRH' in DOCX text!"
    print("[PASS] Test 4: DOCX Wind section populated with exact formulas and without TOTAL RRH lines.")

    # --- Test 3: HTML / WeasyPrint Template Rendering ---
    html_context = {
        "region": "Region 2",
        "terrain_type": "IIIa",
        "building_height": 0.0,
        "vb_m_s": 26.0,
        "kr_z": 0.19,
        "cr_z": 1.25,
        "vm_z": 32.48,
        "iv_z": 0.15,
        "qp_z": 123.57,
        "fw_mat": 10.87,
        "rrh_cf_mat": 1.0,
        "rrh_mat_diam": "88",
        "mat_diam": "88",
        "rrh_mat_epaisseur": "3.2",
        "mat_epaisseur": "3.2",
        "rrh_mat_longueur": "1500",
        "mat_longueur": "1500",
        "rrh_mat_longueur_m": "1.5",
        "mat_longueur_m": "1.5",
        "rrh_mat_section": "TRON 88x3.2",
        "mat_section": "TRON 88x3.2",
        "rrh_plot_section": "TCAR 200x5",
        "plot_section": "TCAR 200x5",
        "rrh_plot_longueur_m": "0.5",
        "plot_longueur_m": "0.5",
        "rrh_mat_diam_m": "0.088",
        "rrh_items": ctx["items"],
        "rrh_totals": ctx["totals"],
        "rrh_is_multi": True,
        "rrh_qty_total": 2,
    }
    rendered_html = render_to_string("ndc/rrh.html", html_context)

    # Validate HTML elements
    assert "RRH AHHB 2600" in rendered_html
    assert "RRH AHDA 900" in rendered_html
    assert "16.81 daN" in rendered_html
    assert "17.94 daN" in rendered_html
    assert "123.57" in rendered_html
    assert "10.87" in rendered_html

    # Ensure NO Total row in Table 0
    # In table, a total row would have <td>Total</td>
    assert "<td>Total</td>" not in rendered_html, "Found unexpected <td>Total</td> in rendered HTML!"
    # Ensure NO TOTAL RRH in wind section
    assert "TOTAL RRH" not in rendered_html, "Found unexpected TOTAL RRH in rendered HTML!"
    print("[PASS] Test 5: WeasyPrint HTML template rendered correctly without Total row and without TOTAL RRH lines.")

    # --- Test 6: Full generate_auxiliary_pdfs integration ---
    from geodata.ndc_generator import generate_auxiliary_pdfs
    mock_job = MockJob()
    pdf_paths = generate_auxiliary_pdfs(mock_job)
    print("Generated auxiliary PDF paths:", pdf_paths)
    assert len(pdf_paths) >= 1, "Expected at least 1 auxiliary PDF generated"
    assert os.path.exists(pdf_paths[0]), f"PDF file does not exist: {pdf_paths[0]}"
    print(f"[PASS] Test 6: generate_auxiliary_pdfs successfully compiled PDF: {pdf_paths[0]}")

    print("\nALL 6 TESTS PASSED SUCCESSFULLY! NDC extraction & rendering is verified.")

if __name__ == "__main__":
    run_tests()
