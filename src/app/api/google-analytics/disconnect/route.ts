import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("user_google_analytics_connections")
    .delete()
    .eq("user_id", user.id);

  if (error) return Response.json({ error: "failed to disconnect Google Analytics" }, { status: 500 });
  return Response.json({ ok: true });
}
