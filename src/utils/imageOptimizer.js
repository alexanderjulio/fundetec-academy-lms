/**
 * Optimiza una imagen convirtiéndola a WebP y reduciendo su tamaño usando la API nativa del navegador (Canvas).
 * No requiere dependencias externas de NPM.
 * 
 * @param {File} imageFile - El archivo de imagen original.
 * @param {Object} options - Opciones de compresión personalizadas.
 * @returns {Promise<File>} - El archivo optimizado.
 */
export async function optimizeImage(imageFile, options = {}) {
  const maxSizeMB = options.isProfile ? 0.1 : 0.8;
  const maxWidthOrHeight = options.isProfile ? 400 : 1920;
  const quality = options.quality || 0.8;

  // Si el archivo ya es muy pequeño y es webp, no hacer nada
  if (imageFile.size < maxSizeMB * 1024 * 1024 && imageFile.type === 'image/webp') {
    return imageFile;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(imageFile);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        // Calcular nuevas dimensiones
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidthOrHeight) {
            height = Math.round((height * maxWidthOrHeight) / width);
            width = maxWidthOrHeight;
          }
        } else {
          if (height > maxWidthOrHeight) {
            width = Math.round((width * maxWidthOrHeight) / height);
            height = maxWidthOrHeight;
          }
        }

        // Crear Canvas para procesamiento
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Dibujar imagen escalada
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a WebP Blob nativamente
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              console.warn('⚠️ Canvas conversion failed, returning original.');
              resolve(imageFile);
              return;
            }

            const newName = imageFile.name.replace(/\.[^/.]+$/, "") + ".webp";
            const optimizedFile = new File([blob], newName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });

            console.log(`✅ Optimized (Native): ${optimizedFile.name} | ${(optimizedFile.size / 1024).toFixed(1)}KB`);
            resolve(optimizedFile);
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => {
        console.error('❌ Error loading image for optimization.');
        resolve(imageFile);
      };
    };

    reader.onerror = () => {
      console.error('❌ Error reading file.');
      resolve(imageFile);
    };
  });
}
