// Profile pictures (v1.0.1). The picture is cropped to a square and shrunk on the device before
// upload, so a 5 MB phone photo becomes a ~30 KB JPEG. Stored in the "avatars" bucket at
// <user id>/avatar.jpg; the profile keeps its public URL, which tracker partners see too.
import { getMeta, setMeta } from "@/lib/local/db";
import { createClient } from "@/lib/supabase/client";

const SIZE = 256;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

type Result = { error?: string };

/** Center-crop to a square and scale to 256×256 JPEG. */
export async function squareJpeg(file: Blob, size = SIZE): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  // JPEG has no transparency; a white backdrop keeps transparent PNGs from turning black
  context.fillStyle = "#fff";
  context.fillRect(0, 0, size, size);
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read that image"))), "image/jpeg", 0.85),
  );
}

async function signedInUser() {
  return (await getMeta<{ userId: string }>("owner"))?.userId;
}

export async function uploadAvatar(file: File): Promise<Result> {
  if (!navigator.onLine) return { error: "You're offline. Connect to change your picture." };
  if (!ACCEPTED_TYPES.includes(file.type)) return { error: "Use a PNG, JPG, WebP or GIF image." };
  if (file.size > MAX_INPUT_BYTES) return { error: "That image is too big. Pick one under 15 MB." };
  const userId = await signedInUser();
  if (!userId) return { error: "Not logged in." };

  let image: Blob;
  try {
    image = await squareJpeg(file);
  } catch {
    return { error: "Couldn't read that image. Try another one." };
  }

  const supabase = createClient();
  const path = `${userId}/avatar.jpg`;
  const upload = await supabase.storage.from("avatars").upload(path, image, {
    upsert: true,
    contentType: "image/jpeg",
    cacheControl: "31536000",
  });
  if (upload.error) return { error: "Couldn't upload the picture. Try again." };

  // Same path every time, so a version in the URL makes browsers fetch the new picture
  const url = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (error) return { error: "Uploaded, but couldn't save it to your profile. Try again." };
  await setMeta("avatarUrl", url);
  return {};
}

export async function removeAvatar(): Promise<Result> {
  if (!navigator.onLine) return { error: "You're offline. Connect to remove your picture." };
  const userId = await signedInUser();
  if (!userId) return { error: "Not logged in." };

  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (error) return { error: "Couldn't remove it. Try again." };
  await supabase.storage.from("avatars").remove([`${userId}/avatar.jpg`]);
  await setMeta("avatarUrl", null);
  return {};
}
