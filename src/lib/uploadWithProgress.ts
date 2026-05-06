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

export function uploadWithProgress<T = unknown>(
  url: string,
  formData: FormData,
  options?: {
    onProgress?: (progress: UploadProgress) => void;
    signal?: AbortSignal;
  }
): Promise<UploadResponse<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.responseType = "text";

    xhr.upload.onprogress = (e) => {
      if (!options?.onProgress) return;
      const total = e.lengthComputable ? e.total : 0;
      const percent = total > 0 ? Math.round((e.loaded / total) * 100) : 0;
      options.onProgress({ loaded: e.loaded, total, percent });
    };

    xhr.onload = () => {
      let body: T | null = null;
      const text = xhr.responseText;
      if (text) {
        try {
          body = JSON.parse(text) as T;
        } catch {
          body = null;
        }
      }
      resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, body });
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

    xhr.send(formData);
  });
}
