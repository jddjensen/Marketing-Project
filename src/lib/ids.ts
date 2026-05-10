// Cheap up-front gate for route params and body IDs. Without it, a non-UUID
// string flows straight into Supabase and Postgres rejects it with
// `invalid input syntax for type uuid`, which the routes were turning into a
// 500 (and in one case echoing the raw error verbatim, leaking the column
// type to clients).
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
