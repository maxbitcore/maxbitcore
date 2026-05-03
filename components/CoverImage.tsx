import React from 'react';

type CoverImageProps = {
  src: string;
  alt: string;
  className?: string;
};

/**
 * Product photos as CSS background — avoids Edge/Chrome "Visual Search" / Lens
 * hover overlays that attach to native &lt;img&gt; (not part of site markup).
 */
export const CoverImage: React.FC<CoverImageProps> = ({ src, alt, className = '' }) => {
  const label = alt.replace(/<[^>]*>?/gm, '').trim() || 'Product';
  return (
    <div
      role="img"
      aria-label={label}
      className={`bg-slate-950 bg-cover bg-center bg-no-repeat ${className}`}
      style={src ? { backgroundImage: `url(${JSON.stringify(src)})` } : undefined}
    />
  );
};
