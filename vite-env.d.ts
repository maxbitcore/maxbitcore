/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_ADMIN_ORDERS_SECRET?: string;
  /** Same as MAXBIT_ORDER_NOTIFY_SECRET in api/order_mail_config.php — used for optional admin deploy emails. */
  readonly VITE_ORDER_NOTIFY_SECRET?: string;
}
