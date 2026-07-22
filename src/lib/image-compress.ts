/**
 * Image Compression Configuration
 * 
 * Quality: 0.75 (75%)
 * - Balances file size with visual quality
 * - Meter readings remain clearly legible
 * - Reduces 5MB photos to ~150-250KB
 * 
 * Max Width: 1200px
 * - Sufficient resolution for OCR
 * - Displays well on all screens
 * - Further reduces file size
 * 
 * Max Size: 250KB
 * - Fits within R2 free tier limits
 * - Fast uploads on mobile networks
 * - Quality auto-reduces if needed
 * 
 * DO NOT increase quality without testing:
 * - Higher quality = larger files
 * - R2 free tier: 10GB storage
 * - Target: ~20,000 photos (250KB each)
 */

import piexif from 'piexifjs';

export interface CompressOptions {
  maxWidthPx?: number;
  quality?: number; // 0 to 1
  maxSizeKb?: number;
}

export async function compressToWebP(
  file: File,
  options: CompressOptions = {}
): Promise<{ blob: Blob; originalSizeKb: number; compressedSizeKb: number }> {
  const { maxWidthPx = 1200, quality = 0.75, maxSizeKb = 250 } = options;
  const originalSizeKb = Math.round(file.size / 1024);

  // Read file as data URL to get EXIF
  let dataURL = '';
  try {
    dataURL = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  } catch {
    // If reading fails, just continue without EXIF correction
  }

  let orientation = 1;
  if (dataURL && (file.type === 'image/jpeg' || file.type === 'image/jpg')) {
    try {
      const exifObj = piexif.load(dataURL);
      if (exifObj['0th'] && exifObj['0th'][piexif.ImageIFD.Orientation]) {
        orientation = exifObj['0th'][piexif.ImageIFD.Orientation];
      }
    } catch {
      // Failed to parse EXIF (maybe none exists)
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let width = img.width;
      let height = img.height;
      
      // Swap width/height for orientation 5-8 (rotated 90 degrees)
      if (orientation >= 5 && orientation <= 8) {
        width = img.height;
        height = img.width;
      }
      
      if (width < 200 || height < 200) {
        URL.revokeObjectURL(url);
        return reject(new Error('Image is too small (minimum 200x200px required)'));
      }
      
      if (width > maxWidthPx) {
        height = Math.round((height * maxWidthPx) / width);
        width = maxWidthPx;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Failed to get canvas context'));
      
      // Handle EXIF orientation by rotating canvas context before drawing
      ctx.save();
      if (orientation >= 5 && orientation <= 8) {
        // We already swapped width and height above for the canvas dimensions.
        // Now set transforms so the original img (which has its original width/height)
        // is drawn correctly into the swapped canvas.
        
        switch (orientation) {
          case 6: // 90° CW
            ctx.translate(canvas.width, 0);
            ctx.rotate((90 * Math.PI) / 180);
            break;
          case 8: // 90° CCW
            ctx.translate(0, canvas.height);
            ctx.rotate((-90 * Math.PI) / 180);
            break;
          case 5: // 90° CW + flip H
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.rotate((90 * Math.PI) / 180);
            break;
          case 7: // 90° CW + flip V
            ctx.translate(canvas.width, canvas.height);
            ctx.scale(1, -1);
            ctx.rotate((90 * Math.PI) / 180);
            break;
        }
        // Draw using original dimensions
        ctx.drawImage(img, 0, 0, height, width);
      } else {
        switch (orientation) {
          case 3: // 180°
            ctx.translate(canvas.width, canvas.height);
            ctx.rotate(Math.PI);
            break;
          case 2: // Flip H
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            break;
          case 4: // Flip V
            ctx.translate(0, canvas.height);
            ctx.scale(1, -1);
            break;
        }
        ctx.drawImage(img, 0, 0, width, height);
      }
      ctx.restore();
      
      let currentQuality = quality;
      const attemptCompression = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Canvas toBlob failed'));
            
            const compressedSizeKb = Math.round(blob.size / 1024);
            
            if (compressedSizeKb > maxSizeKb && currentQuality > 0.1) {
              currentQuality -= 0.1;
              attemptCompression();
            } else {
              resolve({ blob, originalSizeKb, compressedSizeKb });
            }
          },
          'image/webp',
          currentQuality
        );
      };
      
      attemptCompression();
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };
    
    img.src = url;
  });
}
