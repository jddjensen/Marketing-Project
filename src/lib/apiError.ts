import type { NextRequest } from "next/server";
import type { ZodType } from "zod";

// Single source of truth for the API error envelope. Every route already
// returns `{ error: string }`, so this keeps the wire shape identical while
// giving new code one helper to call instead of hand-rolling Response.json.
export function apiError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: Response };

// Parse a JSON request body and validate it against a zod schema. Returns a
// discriminated result so callers early-return `result.response` on failure
// and use `result.data` (fully typed) on success. The first issue's message is
// surfaced — enough for an internal tool, and avoids dumping full zod output.
export async function parseJsonBody<T>(
  request: NextRequest,
  schema: ZodType<T>
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: apiError("body must be valid JSON", 400) };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const prefix = first?.path.length ? `${first.path.join(".")}: ` : "";
    return {
      ok: false,
      response: apiError(
        `${prefix}${first?.message ?? "invalid request body"}`,
        400
      ),
    };
  }
  return { ok: true, data: result.data };
}
