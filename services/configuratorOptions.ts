/** Built-in keys edited in admin and rendered specially in CustomBuildForm. */
export const BUILTIN_CONFIGURATOR_OPTION_KEYS = [
  'purposes',
  'cpuBrands',
  'gpuBrands',
  'gpuManufacturers',
  'ssdSizes',
  'caseSizes',
  'caseTypes',
  'aesthetics',
  'resolutions',
] as const;

export type BuiltinConfiguratorOptionKey = (typeof BUILTIN_CONFIGURATOR_OPTION_KEYS)[number];

export const BUILTIN_CONFIGURATOR_OPTION_KEY_SET = new Set<string>(BUILTIN_CONFIGURATOR_OPTION_KEYS);

export const DEFAULT_CONFIGURATOR_STRING_LISTS: Record<BuiltinConfiguratorOptionKey, string[]> = {
  purposes: ['Gaming', 'Classic', 'Universal', 'Working'],
  cpuBrands: ['Intel', 'AMD'],
  gpuBrands: ['NVIDIA', 'RADEON'],
  gpuManufacturers: ['ASUS', 'MSI', 'Gigabyte', 'Sapphire', 'ASRock'],
  ssdSizes: ['1TB', '2TB', '4TB'],
  caseSizes: ['Mid-Tower', 'Full Tower', 'Mini-ITX'],
  caseTypes: ['Panoramic', 'Airflow', 'Stealth', 'Dual-Chamber'],
  aesthetics: ['Stealth Black', 'Alpine White', 'Black RGB', 'White RGB'],
  resolutions: ['1080p (FHD)', '1440p (QHD)', '2160p (4K)'],
};

function arrayToOptionStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && item !== null && 'value' in item) {
        return String((item as { value: unknown }).value).trim();
      }
      return '';
    })
    .filter(Boolean);
}

/** Merge localStorage JSON with defaults; coerce mixed saved shapes to string lists. */
export function normalizeStoredConfiguratorConfig(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = { ...DEFAULT_CONFIGURATOR_STRING_LISTS };
  if (!raw || typeof raw !== 'object') return out;

  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const strings = arrayToOptionStrings(val);
    if (BUILTIN_CONFIGURATOR_OPTION_KEY_SET.has(key)) {
      const fallback = DEFAULT_CONFIGURATOR_STRING_LISTS[key as BuiltinConfiguratorOptionKey];
      out[key] = strings.length ? strings : fallback;
    } else {
      out[key] = strings;
    }
  }
  return out;
}

export function formatConfiguratorSectionTitle(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Admin-editable storefront titles for configurator sections (custom + optional overrides for built-ins). */
export const CONFIGURATOR_SECTION_LABELS_KEY = 'maxbit_configurator_section_labels';

export function parseConfiguratorSectionLabels(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}

export function resolveConfiguratorSectionTitle(key: string, labels: Record<string, string>): string {
  const custom = labels[key]?.trim();
  if (custom) return custom;
  return formatConfiguratorSectionTitle(key);
}

const CAMEL_KEY = /^[a-z][a-zA-Z0-9]*$/;

export function sanitizeNewConfiguratorSectionKey(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, '');
  if (!s) return null;
  const lower = s.charAt(0).toLowerCase() + s.slice(1);
  return CAMEL_KEY.test(lower) ? lower : null;
}
