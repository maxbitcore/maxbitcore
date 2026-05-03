import { Product } from '../types';

const getStorageKey = (email: string) => `maxbit_wishlist_${email}`;

export const toggleWishlist = (product: any, userEmail: string | undefined): boolean => {
  if (!userEmail) return false;
  
  const key = getStorageKey(userEmail);
  const saved = localStorage.getItem(key);
  let wishlist: any[] = [];
  try {
    wishlist = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(wishlist)) wishlist = [];
  } catch {
    wishlist = [];
  }

  const index = wishlist.findIndex(item => item.id === product.id);
  let isNowWishlisted = false;

  if (index > -1) {
    wishlist = wishlist.filter(item => item.id !== product.id);
    isNowWishlisted = false;
  } else {
    wishlist.push({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      category: product.category
    });
    isNowWishlisted = true;
  }
  
  localStorage.setItem(key, JSON.stringify(wishlist))
  
  window.dispatchEvent(new Event('wishlist-updated'));

  return isNowWishlisted;
};

export const checkIsWishlisted = (productId: string, userEmail: string): boolean => {
  if (!userEmail) return false;
  const saved = localStorage.getItem(getStorageKey(userEmail));
  if (!saved) return false;
  try {
    const wishlist: unknown = JSON.parse(saved);
    if (!Array.isArray(wishlist)) return false;
    return wishlist.some((item: any) =>
      typeof item === 'string' ? item === productId : item?.id === productId,
    );
  } catch {
    return false;
  }
};