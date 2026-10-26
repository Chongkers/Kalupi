// Copies Tesseract's worker script into public/ so it's served from our own domain. A same-origin
// worker is controlled by the service worker, so the OCR engine and language file it downloads
// get cached for offline use (see src/app/sw.ts). Runs before `dev` and `build`.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/tesseract", { recursive: true });
copyFileSync("node_modules/tesseract.js/dist/worker.min.js", "public/tesseract/worker.min.js");
