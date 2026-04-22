import React from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  priority?: boolean;
}

const OptimizedImage = React.forwardRef<HTMLImageElement, OptimizedImageProps>(
  (
    {
      alt,
      decoding = 'async',
      fallbackSrc,
      fetchPriority,
      loading,
      onError,
      priority = false,
      ...props
    },
    ref,
  ) => {
    const handleError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const target = event.currentTarget;

      if (fallbackSrc && target.dataset.fallbackApplied !== 'true') {
        target.dataset.fallbackApplied = 'true';
        target.src = fallbackSrc;
      }

      onError?.(event);
    };

    return (
      <img
        ref={ref}
        alt={alt}
        decoding={decoding}
        fetchPriority={priority ? 'high' : fetchPriority}
        loading={priority ? 'eager' : loading ?? 'lazy'}
        onError={handleError}
        {...props}
      />
    );
  },
);

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;
