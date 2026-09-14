import { Disc } from 'lucide-react';

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
};

const iconSizes = {
  sm: 'w-6 h-6',
  md: 'w-7 h-7',
  lg: 'w-10 h-10',
};

export function ProductImage({ src, alt, size = 'sm', className = '' }: ProductImageProps) {
  const baseClass = `${sizeClasses[size]} rounded-lg object-cover flex-shrink-0 bg-slate-100 border border-slate-200`;

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${baseClass} ${className}`}
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }

  return (
    <div
      className={`${baseClass} flex items-center justify-center text-slate-300 ${className}`}
    >
      <Disc className={iconSizes[size]} />
    </div>
  );
}
