import { apiPost } from "./api";
import type { ImageUploadOut } from "./types";

/** Shrinks a photo in the browser (JPEG, max `maxSize` px on the longest side) so uploads stay small. */
export async function toResizedDataUrl(file: File, maxSize: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Resize + upload; returns the "/api/images/<id>" URL. */
export async function uploadImage(file: File, maxSize: number): Promise<string> {
  const data_url = await toResizedDataUrl(file, maxSize);
  const res = await apiPost<ImageUploadOut>("/images", { data_url });
  return res.url;
}
