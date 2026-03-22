const IMAGE_MAP = {
  protein: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&q=80&w=800',
  whey: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&q=80&w=800',
  mass: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&q=80&w=800',
  'pre-workout': 'https://images.unsplash.com/photo-1583454155184-870a1f63aebc?auto=format&fit=crop&q=80&w=800',
  preworkout: 'https://images.unsplash.com/photo-1583454155184-870a1f63aebc?auto=format&fit=crop&q=80&w=800',
  creatine: 'https://images.unsplash.com/photo-1579722820308-d74e571900a9?auto=format&fit=crop&q=80&w=800',
  bcaa: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=800',
  amino: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=800',
  snack: 'https://images.unsplash.com/photo-1622315750868-2a148a04a6fc?auto=format&fit=crop&q=80&w=800',
  bar: 'https://images.unsplash.com/photo-1525278065053-9a1c1d428bfb?auto=format&fit=crop&q=80&w=800',
  shaker: 'https://images.unsplash.com/photo-1521503862198-2ae9a997bbc9?auto=format&fit=crop&q=80&w=800',
  bottle: 'https://images.unsplash.com/photo-1521503862198-2ae9a997bbc9?auto=format&fit=crop&q=80&w=800',
  glove: 'https://images.unsplash.com/photo-1584380230671-3d96df23daeb?auto=format&fit=crop&q=80&w=800',
  belt: 'https://images.unsplash.com/photo-1584380230671-3d96df23daeb?auto=format&fit=crop&q=80&w=800',
  apparel: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800',
  shirt: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800',
  default: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800'
};

export function getDynamicProductImage(productName) {
  if (!productName) return IMAGE_MAP.default;
  const name = productName.toLowerCase();
  
  for (const [key, url] of Object.entries(IMAGE_MAP)) {
    if (key !== 'default' && name.includes(key)) {
      return url;
    }
  }
  return IMAGE_MAP.default;
}
