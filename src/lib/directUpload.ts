import type { PlatformKey } from "./utm";
import { uploadWithProgress, type UploadProgress } from "./uploadWithProgress";

type DirectUploadResult = {
  id: string;
  creativeId: string;
  versionNum: number;
  url: string;
  posterUrl: string | null;
  name: string;
  kind: "image" | "video" | "text";
  ratio: string;
  platform: string;
};

type SignResponse = {
  uploadUrl: string;
  storagePath: string;
  token: string;
};

// Browser-direct upload for large files (especially video). The flow:
//   1. POST /api/upload/sign  → server returns a signed PUT URL + path
//   2. PUT the file directly to that URL (with progress)
//   3. (optional) Same for the poster image
//   4. POST /api/upload/finalize → server records the media row and returns
//      a signed read URL
// Bypasses the Next.js function for the heavy bytes, which means it works on
// Vercel and any other serverless platform with small request body caps.
export async function uploadVideoDirect(input: {
  file: File;
  poster: Blob | null;
  projectId: string;
  platform: PlatformKey;
  ratio: string;
  signageFormatId?: string;
  replaceCreativeId?: string;
  deletePrevious?: boolean;
  copy?: Record<string, unknown> | null;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}): Promise<DirectUploadResult> {
  const {
    file,
    poster,
    projectId,
    platform,
    ratio,
    signageFormatId,
    replaceCreativeId,
    deletePrevious,
    copy,
    onProgress,
    signal,
  } = input;

  // Track every storage path that's been written so we can clean up if
  // anything after the main PUT fails. Aborts skip cleanup — the user
  // expressed intent to abandon, and the signed URLs are single-use.
  const orphans: string[] = [];

  try {
    // 1. Sign main file.
    const signedMain = await signOne({
      projectId,
      platform,
      ratio,
      kind: "video",
      mimeType: file.type,
      fileSize: file.size,
      fileName: file.name,
      signageFormatId,
      signal,
    });

    // 2. Sign poster in parallel with the main upload (when present).
    let signedPoster: SignResponse | null = null;
    let posterPromise: Promise<void> | null = null;
    if (poster && poster.size > 0) {
      signedPoster = await signOne({
        projectId,
        platform,
        ratio,
        kind: "poster",
        mimeType: poster.type || "image/jpeg",
        fileSize: poster.size,
        fileName: "poster.jpg",
        signageFormatId,
        signal,
      });
      posterPromise = putToSignedUrl(signedPoster.uploadUrl, poster, {
        mimeType: "image/jpeg",
        signal,
      });
    }

    // 3. PUT the main file with progress reporting.
    await putToSignedUrl(signedMain.uploadUrl, file, {
      mimeType: file.type,
      onProgress,
      signal,
    });
    orphans.push(signedMain.storagePath);

    let posterFinalPath: string | null = null;
    if (posterPromise && signedPoster) {
      try {
        await posterPromise;
        posterFinalPath = signedPoster.storagePath;
        orphans.push(posterFinalPath);
      } catch {
        // Poster failure is non-fatal — the video still succeeded.
        // The poster bytes never landed (PUT failed), nothing to clean.
      }
    }

    // 4. Finalize.
    const res = await fetch("/api/upload/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        platform,
        ratio,
        storagePath: signedMain.storagePath,
        posterStoragePath: posterFinalPath,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        signageFormatId: signageFormatId ?? null,
        replaceCreativeId: replaceCreativeId ?? null,
        deletePrevious: deletePrevious ?? false,
        copy: copy ?? null,
      }),
      signal,
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
    } & Partial<DirectUploadResult>;
    if (!res.ok) {
      throw new Error(body.error ?? "upload finalize failed");
    }
    // Finalize succeeded — orphans now have a media row pointing at them,
    // they're no longer orphaned.
    return body as DirectUploadResult;
  } catch (err) {
    // Best-effort cleanup of uploaded bytes when finalize never recorded
    // them. AbortError still triggers cleanup — the user told us to abandon.
    if (orphans.length > 0) {
      try {
        await fetch("/api/upload/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, paths: orphans }),
          // Don't propagate the original signal — the user aborted the
          // upload; the cleanup is a separate, short request.
        });
      } catch {
        /* swallow — cleanup is best-effort */
      }
    }
    throw err;
  }
}

async function signOne(input: {
  projectId: string;
  platform: PlatformKey;
  ratio: string;
  kind: "video" | "poster";
  mimeType: string;
  fileSize: number;
  fileName: string;
  signageFormatId?: string;
  signal?: AbortSignal;
}): Promise<SignResponse> {
  const res = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      platform: input.platform,
      ratio: input.ratio,
      kind: input.kind,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      fileName: input.fileName,
      signageFormatId: input.signageFormatId ?? null,
    }),
    signal: input.signal,
  });
  const body = (await res.json().catch(() => ({}))) as Partial<SignResponse> & {
    error?: string;
  };
  if (!res.ok || !body.uploadUrl || !body.storagePath || !body.token) {
    throw new Error(body.error ?? "could not sign upload");
  }
  return {
    uploadUrl: body.uploadUrl,
    storagePath: body.storagePath,
    token: body.token,
  };
}

async function putToSignedUrl(
  url: string,
  body: Blob | File,
  options: {
    mimeType: string;
    onProgress?: (p: UploadProgress) => void;
    signal?: AbortSignal;
  }
): Promise<void> {
  const result = await uploadWithProgress<unknown>(url, body, {
    method: "PUT",
    headers: { "Content-Type": options.mimeType },
    onProgress: options.onProgress,
    signal: options.signal,
  });
  if (!result.ok) {
    throw new Error(`storage upload failed (HTTP ${result.status})`);
  }
}
