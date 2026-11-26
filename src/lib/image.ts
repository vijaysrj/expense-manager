/** Browser-only helpers for bill photos. */

const MAX_EDGE = 1600; // plenty for reading a receipt, and keeps uploads small
const QUALITY = 0.85;

/**
 * Shrinks a photo from the camera or gallery to a JPEG data URL.
 * Phone photos are often 4-12 MB, which is over the server's upload limit.
 */
export async function shrinkPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
    throw new Error("Please choose a photo of the bill.");
  }
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process this photo.");
  ctx.fillStyle = "#fff"; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img.source, 0, 0, w, h);
  img.close();
  return canvas.toDataURL("image/jpeg", QUALITY);
}

async function loadImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  // createImageBitmap applies the photo's EXIF rotation, so receipts aren't sideways.
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to <img>, which handles some formats (e.g. HEIC on Safari) that bitmaps don't
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const el = new Image();
    el.src = url;
    await el.decode();
    return { source: el, width: el.naturalWidth, height: el.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("This photo format isn't supported here. Try a JPEG or PNG, or take the photo with the camera button.");
  }
}
