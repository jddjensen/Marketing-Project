"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CHANNELS, CHANNEL_CATEGORY_LABELS } from "@/lib/channels";
import type { CustomChannel } from "@/lib/customChannels";

type ProjectChannelNavProps = {
  projectId: string;
  activePlatform?: string;
};

export function ProjectChannelNav({
  projectId,
  activePlatform,
}: ProjectChannelNavProps) {
  // null = still loading; render skeleton pills instead of all 13 built-ins
  // so a small project never flashes the full channel list.
  const [enabledKeys, setEnabledKeys] = useState<Set<string> | null>(null);
  const [customChannels, setCustomChannels] = useState<CustomChannel[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [platformsRes, channelsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/platforms`, {
          cache: "no-store",
        }).catch(() => null),
        fetch("/api/channels/custom", { cache: "no-store" }).catch(() => null),
      ]);
      if (!active) return;
      const platformsBody = platformsRes?.ok
        ? ((await platformsRes.json().catch(() => null)) as {
            platforms?: Array<{ platform: string }>;
          } | null)
        : null;
      const channelsBody = channelsRes?.ok
        ? ((await channelsRes.json().catch(() => null)) as {
            channels?: CustomChannel[];
          } | null)
        : null;
      if (!active) return;
      if (platformsBody?.platforms) {
        const enabled = new Set(platformsBody.platforms.map((p) => p.platform));
        setEnabledKeys(enabled);
        setCustomChannels(
          (channelsBody?.channels ?? []).filter((c) => enabled.has(c.key))
        );
      } else {
        // Degrade to showing every built-in channel rather than an empty bar.
        setEnabledKeys(new Set(CHANNELS.map((c) => c.key)));
        setCustomChannels([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  // Fires when the active tab's anchor mounts (including after the fetch
  // resolves) so it is never left clipped out of the scrollable row.
  const activeTabRef = useCallback((node: HTMLAnchorElement | null) => {
    node?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, []);

  const visibleChannels =
    enabledKeys === null
      ? []
      : CHANNELS.filter(
          (channel) =>
            enabledKeys.has(channel.key) || channel.key === activePlatform
        );

  return (
    <nav
      aria-label="Project channels"
      className="border-t border-zinc-200 bg-white/70 px-6 py-2 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/70"
    >
      <div
        aria-busy={enabledKeys === null}
        className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1"
      >
        <Link
          href={`/projects/${projectId}`}
          transitionTypes={["nav-back"]}
          aria-current={!activePlatform ? "page" : undefined}
          ref={!activePlatform ? activeTabRef : null}
          className={navClass(!activePlatform)}
        >
          Overview
        </Link>
        {enabledKeys === null ? (
          <>
            <span aria-hidden="true" className="skeleton h-7 w-16 shrink-0" />
            <span aria-hidden="true" className="skeleton h-7 w-20 shrink-0" />
            <span aria-hidden="true" className="skeleton h-7 w-14 shrink-0" />
          </>
        ) : (
          <>
            {visibleChannels.map((channel) => (
              <Link
                key={channel.key}
                href={`/projects/${projectId}/${channel.key}`}
                transitionTypes={["nav-forward"]}
                aria-current={
                  activePlatform === channel.key ? "page" : undefined
                }
                ref={activePlatform === channel.key ? activeTabRef : null}
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
                aria-current={
                  activePlatform === channel.key ? "page" : undefined
                }
                ref={activePlatform === channel.key ? activeTabRef : null}
                className={navClass(activePlatform === channel.key)}
                title={`${channel.name} - Custom channel`}
              >
                {channel.name}
              </Link>
            ))}
          </>
        )}
        <Link
          href={`/projects/${projectId}?addChannel=1`}
          aria-label="Add channel"
          title="Add channel"
          className="focus-ring shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          +
        </Link>
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
