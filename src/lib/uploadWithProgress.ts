export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export type UploadResponse<T = unknown> = {
  status: number;
  ok: boolean;
  body: T | null;
};

export type UploadBody = FormData | Blob | File | ArrayBuffer | string;

// XMLHttpRequest wrapper that emits real upload-progress events. Used for:
//   1. Multipart POSTs to /api/upload (FormData body)
//   2. Direct-to-storage PUTs to Supabase signed upload URLs (Blob body)
export function uploadWithProgress<T = unknown>(
  url: string,
  body: UploadBody,
  options?: {
    method?: "POST" | "PUT";
    headers?: Record<string, string>;
    onProgress?: (progress: UploadProgress) => void;
    signal?: AbortSignal;
  }
): Promise<UploadResponse<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options?.method ?? "POST", url, true);
    xhr.responseType = "text";

    if (options?.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        xhr.setRequestHeader(k, v);
      }
    }

    xhr.upload.onprogress = (e) => {
      if (!options?.onProgress) return;
      const total = e.lengthComputable ? e.total : 0;
      const percent = total > 0 ? Math.round((e.loaded / total) * 100) : 0;
      options.onProgress({ loaded: e.loaded, total, percent });
    };

    xhr.onload = () => {
      let parsed: T | null = null;
      const text = xhr.responseText;
      if (text) {
        try {
          parsed = JSON.parse(text) as T;
        } catch {
          parsed = null;
        }
      }
      resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, body: parsed });
    };

    xhr.onerror = () => reject(new Error("network error"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));

    if (options?.signal) {
      if (options.signal.aborted) {
        reject(new DOMException("aborted", "AbortError"));
        return;
      }
      options.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(body as XMLHttpRequestBodyInit);
  });
}
