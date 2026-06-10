import { Product } from '../types';

export type WindowsLicenseChoice = 'none' | 'home' | 'pro';

export const WINDOWS_LICENSE_HOME_ID = 'WIN11-HOME';
export const WINDOWS_LICENSE_PRO_ID = 'WIN11-PRO';

export const WINDOWS_LICENSE_HOME_PRICE = 120;
export const WINDOWS_LICENSE_PRO_PRICE = 145;

const LICENSE_IDS = new Set([WINDOWS_LICENSE_HOME_ID, WINDOWS_LICENSE_PRO_ID]);

export function isWindowsLicenseProductId(id: string): boolean {
  return LICENSE_IDS.has(String(id || '').trim());
}

/** Optional Windows add-on — only on Gaming PC product pages. */
export function isGamingPcProduct(product: Pick<Product, 'category'>): boolean {
  const cat = String(product.category || '').trim().toLowerCase();
  if (!cat) return false;
  if (cat === 'components' || cat === 'peripherals') return false;
  return (
    cat === 'gaming pcs' ||
    cat === 'gaming pc' ||
    cat === 'systems' ||
    cat === 'system' ||
    cat.includes('gaming')
  );
}

export function buildWindowsLicenseProduct(
  choice: Exclude<WindowsLicenseChoice, 'none'>,
  parentProductId?: string
): Product {
  const base =
    choice === 'home'
      ? {
          id: WINDOWS_LICENSE_HOME_ID,
          name: 'Windows 11 Home',
          price: WINDOWS_LICENSE_HOME_PRICE,
          category: 'Add-on',
          status: 'In Stock' as const,
          imageUrl: '',
          description: 'Optional Microsoft Windows 11 Home license for your build.',
        }
      : {
          id: WINDOWS_LICENSE_PRO_ID,
          name: 'Windows 11 Pro',
          price: WINDOWS_LICENSE_PRO_PRICE,
          category: 'Add-on',
          status: 'In Stock' as const,
          imageUrl: '',
          description: 'Optional Microsoft Windows 11 Pro license for your build.',
        };

  return parentProductId ? { ...base, bundleParentId: parentProductId } : base;
}

export function windowsLicenseAddonPrice(choice: WindowsLicenseChoice): number {
  if (choice === 'home') return WINDOWS_LICENSE_HOME_PRICE;
  if (choice === 'pro') return WINDOWS_LICENSE_PRO_PRICE;
  return 0;
}

/** Read linked Windows add-on for a gaming PC already in cart. */
export function windowsLicenseChoiceFromCart(
  items: Product[],
  productId: string
): WindowsLicenseChoice {
  const pid = String(productId || '').trim();
  if (!pid) return 'none';
  for (const item of items || []) {
    if (!isWindowsLicenseProductId(item.id)) continue;
    if (String(item.bundleParentId || '').trim() !== pid) continue;
    if (item.id === WINDOWS_LICENSE_HOME_ID) return 'home';
    if (item.id === WINDOWS_LICENSE_PRO_ID) return 'pro';
  }
  return 'none';
}

export function isProductInCart(items: Product[], productId: string): boolean {
  const pid = String(productId || '').trim();
  if (!pid) return false;
  return (items || []).some(
    (item) => !isWindowsLicenseProductId(item.id) && String(item.id).trim() === pid
  );
}

export function stripHtmlName(name: string): string {
  return String(name || '').replace(/<[^>]*>/g, '').trim();
}

/** Group cart lines: PC first, its Windows add-on nested under the same block. */
export function groupCartItemsForDisplay(items: Product[]): { item: Product; index: number; isAddon: boolean; parentName?: string }[] {
  const rows: { item: Product; index: number; isAddon: boolean; parentName?: string }[] = [];
  const used = new Set<number>();

  items.forEach((item, index) => {
    if (used.has(index) || isWindowsLicenseProductId(item.id)) return;

    rows.push({ item, index, isAddon: false });

    const licenseIdx = items.findIndex(
      (other, otherIdx) =>
        !used.has(otherIdx) &&
        isWindowsLicenseProductId(other.id) &&
        String(other.bundleParentId || '') === String(item.id)
    );
    if (licenseIdx >= 0) {
      used.add(licenseIdx);
      rows.push({
        item: items[licenseIdx],
        index: licenseIdx,
        isAddon: true,
        parentName: stripHtmlName(item.name),
      });
    }
    used.add(index);
  });

  items.forEach((item, index) => {
    if (used.has(index)) return;
    rows.push({ item, index, isAddon: isWindowsLicenseProductId(item.id) });
    used.add(index);
  });

  return rows;
}
