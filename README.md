# NDC - Network Data Center System

Unified full-stack application for antenna equipment management, geodata terrain classification, automated structural calculations via Autodesk Robot Structural Analysis, and Eurocode FR compliance report generation.

---

## 🏗️ Architecture Overview

The system runs on a unified single-machine architecture (or distributed across servers):

```
NDC System (Localhost)
├── 🌐 React Frontend (Vite)         http://127.0.0.1:5173
├── ⚙️ Django Backend (Daphne/ASGI)  http://127.0.0.1:8000/api/
├── 🤖 Robot COM Worker (FastAPI)    http://127.0.0.1:8001/api/status
└── 🗄️ Database                       PostgreSQL 18 + PostGIS (Port 5432)
```

---

## 📁 Repository Structure

```
├── backend/                  # Django 5.2 ASGI Backend (Port 8000)
│   ├── api/                  # REST API & Calculation job models
│   ├── geodata/              # MapLibre/PostGIS terrain classification & raster/vector services
│   ├── templates/            # Django HTML templates
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/                 # React 18 + Vite Frontend (Port 5173)
│   ├── src/                  # React components, Zustand stores, MapLibre GL viewers
│   ├── public/               # Static assets & diagrams
│   └── package.json
│
├── worker/                   # Autodesk Robot 2027 COM Worker (Port 8001)
│   ├── robot_worker.py       # FastAPI worker controlling Autodesk Robot via COM API
│   ├── check_msgs.py         # Utility to inspect Robot calculation messages
│   ├── dump_materials.py     # Material dump utility
│   ├── templates/            # Report templates (.docx)
│   └── docs/                 # Eurocode & section catalog references
│
├── start_ndc.bat             # One-click Windows launcher
└── start_ndc.ps1             # PowerShell launcher script
```

---

## 🚀 Quick Start

### 1. Prerequisites
1. **Windows 10 / 11** with **Autodesk Robot Structural Analysis Professional 2027**.
2. **Python 3.10+** (tested up to 3.14).
3. **Node.js LTS (v20+)** and **npm**.
4. **PostgreSQL 18** with **PostGIS 3.x** extension.

### 2. Environment Configuration
* **Backend:** Copy `backend/.env.example` to `backend/.env` and configure your `DATABASE_URL` and `SECRET_KEY`.
* **Frontend:** Copy `frontend/.env.example` (or set `VITE_API_URL=http://127.0.0.1:8000` and `VITE_WORKER_URL=http://127.0.0.1:8001`).

### 3. Launching All Services
Start the entire stack (Worker, Django Backend, and React Frontend) with a single command:

* **Double-Click:** Run `start_ndc.bat`
* **Or via PowerShell:**
  ```powershell
  .\start_ndc.ps1
  ```

---

## 🧪 Service URLs & Default Credentials

| Service | URL | Notes |
| :--- | :--- | :--- |
| **Frontend** | `http://127.0.0.1:5173` | Interactive terrain & calculation portal |
| **Django API / Admin** | `http://127.0.0.1:8000/admin/` | Default Admin: `admin` / `Admin123!` |
| **Worker Health** | `http://127.0.0.1:8001/api/status` | FastAPI status & Robot COM health |

---

## 📄 License
Private / Proprietary
