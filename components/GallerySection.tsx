import React from 'react';
import OptimizedImage from './OptimizedImage';

interface GallerySectionProps {
  title: string;
  images?: string[];
  description?: string;
}

const GallerySection: React.FC<GallerySectionProps> = ({ title, images = [], description }) => {
  if (!images.length) {
    return null;
  }

  return (
    <section className="mt-16">
      <h2 className="text-3xl font-bold text-white text-center">{title}</h2>
      {description && <p className="mt-3 text-center text-gray-300">{description}</p>}
      <div className="mt-8 overflow-hidden">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {images.map((imageUrl, index) => (
            <div
              key={`${imageUrl}-${index}`}
              className="relative h-48 w-80 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5"
            >
              <OptimizedImage
                src={imageUrl}
                alt={`${title} image ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GallerySection;
