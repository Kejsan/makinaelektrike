/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly PUBLIC_GOOGLE_MAPS_API_KEY?: string;
  readonly GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_ENABLE_GEMINI_PREFILL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
