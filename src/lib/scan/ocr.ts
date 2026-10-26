// Reads the text in a screenshot, on the device (Tesseract.js). The image never leaves the phone
// and isn't kept. The first scan downloads the OCR engine and English language file (a few MB);
// after that they come from the service worker cache and IndexedDB, so scanning works offline.

export type OcrProgress = { stage: "loading" | "reading"; percent: number };

export async function readText(image: Blob, onProgress?: (p: OcrProgress) => void): Promise<string> {
  // Loaded only when someone scans, so it isn't in every page's bundle
  const { createWorker } = await import("tesseract.js");

  const worker = await createWorker("eng", 1, {
    // Same-origin worker (scripts/copy-tesseract.mjs), so the service worker can cache what it loads
    workerPath: "/tesseract/worker.min.js",
    workerBlobURL: false,
    logger: (m) => {
      if (!onProgress) return;
      const stage = m.status === "recognizing text" ? "reading" : "loading";
      onProgress({ stage, percent: Math.round((m.progress ?? 0) * 100) });
    },
  });

  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
