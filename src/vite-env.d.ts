/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OpenRouter key for the introduction text. Demo only: it ends up in the browser bundle. */
  readonly VITE_OPENROUTER_API_KEY?: string;
  readonly VITE_OPENROUTER_MODEL?: string;
}
