"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CHANNELS, CHANNEL_CATEGORY_LABELS } from "@/lib/channels";
import { isCustomPlatformKey, type CustomChannel } from "@/lib/customChannels";

type ProjectChannelNavProps = {
  projectId: string;
  activePlatform?: string;
};

export function ProjectChannelNav({
  projectId,
  activePlatform,
}: ProjectChannelNavProps) {
  // Built-in channels render statically; custom channels are appended once
  // the project's enabled platform keys and the account's channel list load.
  const [customChannels, setCustomChannels] = useState<CustomChannel[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [platformsRes, channelsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/platforms`, { cache: "no-store" }),
        fetch("/api/channels/custom", { cache: "no-store" }),
      ]);
      if (!platformsRes.ok || !channelsRes.ok) return;
      const platformsBody = (await platformsRes.json().catch(() => null)) as {
        platforms?: Array<{ platform: string }>;
      } | null;
      const channelsBody = (await channelsRes.json().catch(() => null)) as {
        channels?: CustomChannel[];
      } | null;
      if (!active) return;
      const enabled = new Set(
        (platformsBody?.platforms ?? [])
          .map((p) => p.platform)
          .filter(isCustomPlatformKey)
      );
      setCustomChannels(
        (channelsBody?.channels ?? []).filter((c) => enabled.has(c.key))
      );
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <nav
      aria-label="Project channels"
      className="border-t border-zinc-200 bg-white/70 px-6 py-2 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/70"
    >
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1">
        <Link
          href={`/projects/${projectId}`}
          transitionTypes={["nav-back"]}
          aria-current={!activePlatform ? "page" : undefined}
          className={navClass(!activePlatform)}
        >
          Overview
        </Link>
        {CHANNELS.map((channel) => (
          <Link
            key={channel.key}
            href={`/projects/${projectId}/${channel.key}`}
            transitionTypes={["nav-forward"]}
            aria-current={activePlatform === channel.key ? "page" : undefined}
            className={navClass(activePlatform === channel.key)}
            title={`${channel.name} - ${CHANNEL_CATEGORY_LABELS[channel.category]}`}
          >
            {channel.name}
          </Link>
        ))}
        {customChannels.map((channel) => (
          <Link
            key={channel.key}
            href={`/projects/${projectId}/channels/${channel.id}`}
            transitionTypes={["nav-forward"]}
            aria-current={activePlatform === channel.key ? "page" : undefined}
            className={navClass(activePlatform === channel.key)}
            title={`${channel.name} - Custom channel`}
          >
            {channel.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function navClass(active: boolean) {
  return `whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-ring ${
    active
      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
  }`;
}
