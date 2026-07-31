#!/bin/bash
echo "Starting data import..." > download_monday_docs.Log
venv/bin/python manage.py import_excel_data /home/mahdi/CascadeProjects/ndc/backend/data/BDD_NDC_CAS_1_Ant_4G_int_gr_e_et_5G_sur_bras_15m_1785417298.xlsx >> download_monday_docs.Log 2>&1
venv/bin/python manage.py import_excel_data /home/mahdi/CascadeProjects/ndc/backend/data/BDD_NDC_CAS_1_Ant_4G_int_gr_e_et_5G_sur_bras_1785417228.xlsx >> download_monday_docs.Log 2>&1
venv/bin/python manage.py import_excel_data /home/mahdi/CascadeProjects/ndc/backend/data/BDD_NDC_CAS_1_Ant_4G_int_gr_e_et_5G_sur_bras_1785417269.xlsx >> download_monday_docs.Log 2>&1
venv/bin/python manage.py import_excel_data /home/mahdi/CascadeProjects/ndc/backend/data/BDD_NDC_CAS_1_Ant_4G_int_gr_e_et_5G_sur_bras_1785417287.xlsx >> download_monday_docs.Log 2>&1
echo "Starting download_monday_docs..." >> download_monday_docs.Log
venv/bin/python manage.py download_monday_docs >> download_monday_docs.Log 2>&1
