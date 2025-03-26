/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly ADMIN_PASSWORD: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 
