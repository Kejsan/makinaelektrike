/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly PUBLIC_GOOGLE_MAPS_API_KEY?: string;
  readonly GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_OCM_API_KEY?: string;
  readonly OCM_API_KEY?: string;
  readonly VITE_R2_ACCOUNT_ID: string;
  readonly VITE_R2_ACCESS_KEY_ID: string;
  readonly VITE_R2_SECRET_ACCESS_KEY: string;
  readonly VITE_R2_BUCKET_NAME: string;
  readonly VITE_R2_PUBLIC_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
