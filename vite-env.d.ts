/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_KEY: string
    readonly VITE_SPREADSHEET_ID: string
    readonly VITE_SHEET_GID: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
