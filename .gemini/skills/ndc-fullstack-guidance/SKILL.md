---
name: ndc-fullstack-guidance
description: "Core architectural rules and best practices for the NDC application. ACTIVATE this skill whenever you need to add new features, refactor code, or work with the project's technology stack (React, Vite, Django, PostgreSQL 18)."
---

# NDC Full Stack Guidance

This skill contains the core constraints, architecture patterns, and best practices tailored specifically for the `ndc` application stack. These rules are adapted from the `claude-skills` fullstack profiles.

## 1. Full Stack Architecture
- **Pattern:** Modular Monolith (Django backend) + Single Page Application (React/Vite frontend).
- **Communication:** REST APIs via Django REST Framework.
- **Constraints:**
  - Avoid unnecessary microservices. Stick to the modular monolith until scaling dictates otherwise.
  - No raw SQL unless absolutely justified; use Django ORM.

## 2. Backend Skills (Django 5 + DRF + PostgreSQL 18)
### Stack Elements:
- Django 5.x, Django REST Framework, PostgreSQL 18, GeoPandas/Mapbox (GIS).

### Best Practices & Rules:
- **Thin Views, Fat Models/Services:** Keep API views/viewsets as thin as possible. Delegate complex business logic to service layers or model methods.
- **Query Optimization:** Prevent N+1 queries by aggressively using `.select_related()` (for foreign keys) and `.prefetch_related()` (for many-to-many/reverse foreign keys).
- **PostgreSQL 18 Leverage:** Utilize advanced PostgreSQL 18 features where applicable (e.g., `JSONB` for unstructured data, window functions). Ensure `psycopg` (v3) is correctly configured.
- **Background Tasks:** Do not spawn threads directly in Django views. If background processing is needed, use Celery or Django-RQ.
- **Security & Rate Limiting:** Apply rate limiting to all public-facing endpoints. Never hardcode secrets; use `python-decouple` / `.env`.
- **Validation:** Rely on DRF Serializers for incoming data validation.
- **Testing:** Maintain high test coverage using `pytest` + `pytest-django` + `factory-boy`.

## 3. Frontend Skills (React 18 + Vite + Tailwind + MapLibre)
### Stack Elements:
- React 18, Vite, TypeScript, Tailwind CSS, React Router DOM, MapLibre-GL.

### Best Practices & Rules:
- **Build Tooling:** Use Vite exclusively. Ensure strict mode is enabled in TypeScript (`tsconfig.json`).
- **Component Architecture:** Use functional components and React Hooks. Break large components into smaller, reusable ones.
- **Routing & Splitting:** Use `react-router-dom`. **Route-level code splitting is mandatory** to maintain a small initial bundle size (`React.lazy` and `<Suspense>`).
- **State Management:** Avoid using React Context for global state if it triggers cascading re-renders. Use Zustand/Jotai for UI state, and React Query (if added later) for server state.
- **Styling:** Use Tailwind CSS for all styling to maintain consistency. Group utility classes logically.
- **Mapping & GIS:** Use `maplibre-gl` for terrain/map rendering. Ensure map instances are properly cleaned up in `useEffect` cleanup functions to prevent memory leaks.
- **Performance:** Keep the `initial_bundle_kb_gzip_max` below 200KB. Ensure LCP (Largest Contentful Paint) is optimized.

## 4. Workflows & Validation
- Before implementing major features, explicitly outline the API contract (Request/Response format) and database schema changes.
- Ensure all Python code is formatted/linted (e.g., Black/Ruff).
- Ensure all TypeScript code adheres to ESLint rules configured in the frontend.
- When generating new components or endpoints, include basic error handling and loading states by default.
