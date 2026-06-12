import { notFound } from "next/navigation";
import { PlatformMediaBoard } from "@/app/_components/PlatformMediaBoard";
import {
  CUSTOM_CHANNEL_KIND_LABELS,
  customPlatformKey,
  formatDimensionLabel,
  type CustomChannelKind,
} from "@/lib/customChannels";
import { isUuid } from "@/lib/ids";
import { loadProject } from "@/lib/projects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function CustomChannelPage({
  params,
}: {
  params: Promise<{ id: string; channelId: string }>;
}) {
  const { id, channelId } = await params;
  if (!isUuid(channelId)) notFound();

  const supabase = await createSupabaseServerClient();
  const [project, channelRes, formatsRes] = await Promise.all([
    loadProject(id),
    supabase
      .from("custom_channels")
      .select("id, name, description, kind")
      .eq("id", channelId)
      .maybeSingle(),
    supabase
      .from("custom_channel_formats")
      .select("id, label, width, height, unit, position")
      .eq("channel_id", channelId)
      .order("position", { ascending: true }),
  ]);
  const channel = channelRes.data;
  if (channelRes.error || !channel) notFound();

  const kindLabel =
    CUSTOM_CHANNEL_KIND_LABELS[channel.kind as CustomChannelKind] ??
    channel.kind;
  const ratios = (formatsRes.data ?? []).map((f) => {
    const width = Number(f.width);
    const height = Number(f.height);
    return {
      key: f.id,
      label: f.label,
      aspect: "",
      hint: formatDimensionLabel({ width, height, unit: f.unit }),
      ratio: width / height,
      size: { width, height, unit: f.unit },
    };
  });

  return (
    <PlatformMediaBoard
      projectId={id}
      projectName={project.name}
      platform={customPlatformKey(channel.id)}
      title={`${channel.name} — Campaign Media`}
      subtitle={
        channel.description ?? `Custom ${kindLabel.toLowerCase()} channel.`
      }
      ratios={ratios}
      trackingEnabled={false}
    />
  );
}
