import {
  getUserGoogleAnalyticsAccessToken,
  isGoogleAnalyticsError,
  listGoogleAnalyticsProperties,
} from "@/lib/googleAnalytics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const accessToken = await getUserGoogleAnalyticsAccessToken(supabase, user.id);
    const properties = await listGoogleAnalyticsProperties(accessToken);
    return Response.json({ properties });
  } catch (error) {
    if (isGoogleAnalyticsError(error)) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "failed to load Google Analytics properties" }, { status: 500 });
  }
}
