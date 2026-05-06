/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_ADMIN_ORDERS_SECRET?: string;
}
