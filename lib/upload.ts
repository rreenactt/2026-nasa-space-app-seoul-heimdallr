import "client-only";

/**
 * Uploads a file from the browser straight to object storage with a presigned URL from the server
 * (`createUploadUrl` in `lib/storage.ts`), so the file never passes through a Vercel function.
 *
 * Uses XMLHttpRequest instead of `lib/ky.ts`: fetch reports upload progress only with a streamed body, which
 * Chromium sends only over HTTP/2 and fails outright over HTTP/1.1. There is no retry; the caller asks the server for
 * a new URL and calls this again.
 */

export type SignedUploadTarget = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
};

export type UploadProgress = { loaded: number; total: number };

export class UploadError extends Error {
  constructor(
    message: string,
    /** HTTP status from storage, or 0 for a network failure, an abort or a timeout. */
    readonly status: number,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export function uploadToSignedUrl(
  file: Blob,
  target: SignedUploadTarget,
  { onProgress, signal }: { onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadError("Upload aborted", 0));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.url);
    for (const [name, value] of Object.entries(target.headers)) xhr.setRequestHeader(name, value);

    if (onProgress) {
      xhr.upload.onprogress = (event) => onProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : file.size });
    }
    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const settle = (error?: UploadError) => {
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };

    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? settle()
        : // 403 usually means the URL expired or the file's type or size differs from what was signed.
          settle(new UploadError(`Upload failed with HTTP ${xhr.status}`, xhr.status));
    // A CORS rejection also lands here: the browser hides the reason, so check the bucket's CORS rule.
    xhr.onerror = () => settle(new UploadError("Upload failed: network error or blocked by CORS", 0));
    xhr.onabort = () => settle(new UploadError("Upload aborted", 0));
    xhr.ontimeout = () => settle(new UploadError("Upload timed out", 0));
    xhr.send(file);
  });
}
