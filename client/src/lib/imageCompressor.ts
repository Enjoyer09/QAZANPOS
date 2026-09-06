/**
 * Compresses an image file in the browser using HTML5 Canvas API.
 * Converts to WebP format with a max dimension of 1200px.
 */
export interface CompressionResult {
  file: File;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export async function compressImage(
  file: File,
  maxDimension: number = 1200,
  quality: number = 0.82
): Promise<CompressionResult> {
  const originalSize = file.size;

  // If already small svg or gif, or not image, skip canvas compression
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return {
      file,
      previewUrl: URL.createObjectURL(file),
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let { width, height } = img;

        // Resize down proportionally if larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context could not be created"));
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Image compression failed"));
              return;
            }

            const cleanBaseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
            const compressedFile = new File([blob], `${cleanBaseName}.webp`, {
              type: "image/webp",
              lastModified: Date.now(),
            });

            const compressedSize = compressedFile.size;
            const compressionRatio = Math.max(
              0,
              Math.round(((originalSize - compressedSize) / originalSize) * 100)
            );

            const previewUrl = URL.createObjectURL(compressedFile);

            resolve({
              file: compressedFile,
              previewUrl,
              originalSize,
              compressedSize,
              compressionRatio,
            });
          },
          "image/webp",
          quality
        );
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}
