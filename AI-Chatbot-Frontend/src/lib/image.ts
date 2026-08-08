/**
 * Client-side image compression so uploads stay small and fast.
 * Downscales large images to maxDimension and re-encodes as WebP/JPEG.
 */
export function compressImage(
  file: File,
  maxDimension = 1400,
  quality = 0.82
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read the image file.'));
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas is not supported');

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const useWebp =
            typeof HTMLCanvasElement.prototype.toBlob === 'function' &&
            canvas.toDataURL('image/webp').startsWith('data:image/webp');
          const mimeType = useWebp ? 'image/webp' : 'image/jpeg';

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Could not compress the image.'));
                return;
              }
              const ext = useWebp ? 'webp' : 'jpg';
              const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
              resolve(
                new File([blob], `${baseName}.${ext}`, { type: mimeType })
              );
            },
            mimeType,
            quality
          );
        } catch (error) {
          reject(error as Error);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}
