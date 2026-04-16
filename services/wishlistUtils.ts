// Ключ для хранения с привязкой к email
const getStorageKey = (email: string) => `maxbit_wishlist_${email}`;

export const toggleWishlist = (productId: string, userEmail: string): boolean => {
  const key = getStorageKey(userEmail);
  const saved = localStorage.getItem(key);
  let wishlist: string[] = saved ? JSON.parse(saved) : [];

  let isNowWishlisted = false;

  if (wishlist.includes(productId)) {
    wishlist = wishlist.filter(id => id !== productId);
    isNowWishlisted = false;
  } else {
    wishlist.push(productId);
    isNowWishlisted = true;
  }
  
  localStorage.setItem(key, JSON.stringify(wishlist));
  return isNowWishlisted;
};

export const checkIsWishlisted = (productId: string, userEmail: string): boolean => {
  const saved = localStorage.getItem(getStorageKey(userEmail));
  const wishlist: string[] = saved ? JSON.parse(saved) : [];
  return wishlist.includes(productId);
};