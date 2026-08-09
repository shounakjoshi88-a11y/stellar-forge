/**
 * Downscale + re-encode an image straight in the browser.
 *
 * Draws the image onto a canvas capped at `maxDim` on its longest side and
 * encodes as WebP (falling back to JPEG). Web banners are shown ~1600px wide,
 * so anything bigger is wasted bandwidth — capping there + ~85% quality keeps
 * the picture looking identical while cutting the payload dramatically.
 */
export function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas support required"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      const mime = canvas.toDataURL("image/webp").startsWith("data:image/webp;") ? "image/webp" : "image/jpeg";
      resolve(canvas.toDataURL(mime, quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image"));
    };

    img.src = url;
  });
}

export function dataUrlSizeKb(dataUrl: string): number {
  return Math.round((dataUrl.length * 3) / 4 / 1024);
}