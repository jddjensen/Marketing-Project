// Important: Next.js / Turbopack inlines NEXT_PUBLIC_* env vars at compile
// time only when accessed via literal property notation (process.env.NAME).
// Dynamic bracket access (process.env[name]) is NOT replaced — the browser
// bundle ends up reading from an empty process.env and throws. So we keep
// the literal references here and pass the value through requireEnv for the
// runtime check + friendly error.

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing ${name}. Copy .env.local.example to .env.local and fill in your Supabase project's URL and anon key (Dashboard → Project Settings → API).`
    );
  }
  return value;
}

export function supabaseEnv(): { url: string; anonKey: string } {
  return {
    url: requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    anonKey: requireEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
  };
}
