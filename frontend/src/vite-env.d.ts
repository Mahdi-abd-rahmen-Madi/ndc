/// <reference types="maplibre-gl" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WORKER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
