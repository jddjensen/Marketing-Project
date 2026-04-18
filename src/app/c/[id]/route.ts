import { NextRequest } from "next/server";
import { readStore, writeStore } from "@/lib/tracking";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const store = await readStore();
  const item = store.items.find((i) => i.id === id);
  if (!item) {
    return new Response("Not found", { status: 404 });
  }
  item.clicks += 1;
  await writeStore(store);
  return Response.redirect(item.url, 302);
}
