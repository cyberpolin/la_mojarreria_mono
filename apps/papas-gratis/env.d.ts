/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WA_API_BASE_URL: string
  readonly VITE_WA_API_KEY: string
  readonly VITE_WA_CLIENT_DOMAIN: string
  readonly VITE_WA_CAMPAIGN_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
