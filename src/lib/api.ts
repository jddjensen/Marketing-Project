export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation_error"
  | "server_error";

export type ApiErrorPayload = {
  error: {
    code: ApiErrorCode | string;
    message: string;
  };
};

export function apiError(
  code: ApiErrorCode | string,
  message: string,
  status: number
) {
  return Response.json({ error: { code, message } } satisfies ApiErrorPayload, {
    status,
  });
}

export function apiErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string") return error;
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
    ) {
      return (error as { message: string }).message;
    }
  }
  return fallback;
}

export async function readJsonObject(
  request: Request
): Promise<Record<string, unknown> | null> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

export function normalizeOptionalString(
  value: unknown
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function validateRequiredString(
  value: unknown,
  label: string,
  options: { maxLength: number }
): { value: string } | { error: string } {
  if (typeof value !== "string") return { error: `${label} required` };
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > options.maxLength) {
    return { error: `${label} must be 1-${options.maxLength} chars` };
  }
  return { value: trimmed };
}

export function validateHttpUrl(
  value: unknown
): { value: string } | { error: string } {
  if (typeof value !== "string") return { error: "url required" };
  const url = value.trim();
  if (url.length === 0 || url.length > 2048) {
    return { error: "url must be 1-2048 chars" };
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { error: "url must be http(s)" };
    }
  } catch {
    return { error: "url must be a valid http(s) URL" };
  }
  return { value: url };
}
