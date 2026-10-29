import type { PluginCleanup } from "@getpaseo/plugin";
import type {
  PluginButtonRegistration,
  PluginClientContext,
  PluginCommandCapabilities,
} from "@getpaseo/plugin/client";
import { copyText } from "@getpaseo/plugin/client/react-native";
import { AuthScreen } from "./client/auth-screen";
import { ShareResultCard } from "./client/share-result-card";
import {
  shareResultKind,
  shareResultSchema,
  shareSessionRpc,
  type ShareResultData,
} from "./shared/share-session";

const SETTINGS_SCREEN_ID = "agent-share-settings";

function newItemId(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `share-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function appendShareResult(
  ctx: PluginCommandCapabilities,
  agentId: string,
  data: ShareResultData,
): Promise<void> {
  try {
    await ctx.paseo.agents.ref(agentId).timeline.append({
      type: "plugin",
      id: newItemId(),
      kind: shareResultKind,
      version: 1,
      data,
    });
  } catch (error) {
    console.warn("[agent-share] Failed to append timeline item:", error);
  }
}

async function shareAgent(ctx: PluginCommandCapabilities, agentId: string): Promise<void> {
  try {
    const result = await ctx.rpc(shareSessionRpc, { agentId });
    await copyText(result.url).catch((error) => {
      console.warn("[agent-share] Clipboard copy failed:", error);
    });
    await appendShareResult(ctx, agentId, {
      status: "shared",
      url: result.url,
      title: result.title,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[agent-share] Share failed:", error);
    await appendShareResult(ctx, agentId, {
      status: "failed",
      error: message,
      exportedAt: new Date().toISOString(),
    });
    if (/token|setup|authoriz/i.test(message)) {
      try {
        ctx.openSettings(SETTINGS_SCREEN_ID);
      } catch {
        // Settings surface unavailable on this host — the timeline card still reports the failure.
      }
    }
  }
}

export default function contribute(client: PluginClientContext): PluginCleanup {
  const cleanups: PluginCleanup[] = [];

  cleanups.push(
    client.addSettingsScreen({
      id: SETTINGS_SCREEN_ID,
      title: "Agent Share",
      icon: "Share2",
      Component: AuthScreen,
    }),
  );

  cleanups.push(
    client.addTimelineRenderer({
      kind: shareResultKind,
      version: 1,
      schema: shareResultSchema,
      Component: ShareResultCard,
    }),
  );

  cleanups.push(
    client.addCommandCenterItem({
      id: "agent-share-setup",
      title: "Setup GitHub Gist sharing",
      icon: "Settings",
      context: "global",
      onSelect(ctx) {
        ctx.openSettings(SETTINGS_SCREEN_ID);
      },
    }),
  );

  cleanups.push(
    client.addCommandCenterItem({
      id: "agent-share-session",
      title: "Share session as Markdown",
      icon: "FileText",
      keywords: ["share", "gist", "markdown", "export"],
      context: "agent",
      onSelect: (ctx) => shareAgent(ctx, ctx.agent.id),
    }),
  );

  cleanups.push(
    client.addSlashCommand({
      name: "share",
      description: "Share this session as a public GitHub Gist",
      argumentHint: "",
      context: "agent",
      onSubmit: (ctx) => shareAgent(ctx, ctx.agent.id),
    }),
  );

  const pillRegistrations = new Map<string, PluginButtonRegistration>();
  type AgentListEntry = {
    agent: { id: string; workspaceId: string | null; archivedAt: string | null; internal?: boolean | null };
  };
  type AgentListSnapshot = { entries: AgentListEntry[] };
  type AgentListSubscription = {
    subscribe(observer: {
      snapshot(snapshot: AgentListSnapshot): void;
      update(message: unknown): void;
    }): () => void;
    release(): Promise<void>;
  };
  let subscription: AgentListSubscription | null = null;
  let disposed = false;

  const syncPills = (entries: readonly AgentListEntry[]) => {
    const live = new Set<string>();
    for (const entry of entries) {
      const agent = entry.agent;
      if (agent.archivedAt || !agent.workspaceId || agent.internal) continue;
      live.add(agent.id);
      if (pillRegistrations.has(agent.id)) continue;
      const agentId = agent.id;
      const workspaceId = agent.workspaceId;
      pillRegistrations.set(
        agentId,
        client.addComposerPill({
          id: `agent-share-${agentId}`,
          workspaceId,
          agentId,
          button: {
            title: "Share session",
            label: "Share",
            icon: "Share2",
            behavior: {
              kind: "action",
              onPress: () => shareAgent(client, agentId),
            },
          },
        }),
      );
    }
    for (const [agentId, registration] of pillRegistrations) {
      if (!live.has(agentId)) {
        registration.remove();
        pillRegistrations.delete(agentId);
      }
    }
  };

  void client.paseo.agents
    .list({ subscribe: {}, page: { limit: 200 } })
    .then((result) => {
      if (disposed) {
        void result.subscription?.release();
        return;
      }
      subscription = (result.subscription as AgentListSubscription | undefined) ?? null;
      syncPills(result.entries as AgentListEntry[]);
      subscription?.subscribe({
        snapshot: (snapshot) => syncPills(snapshot.entries),
        update: () => {},
      });
    })
    .catch((error) => {
      console.warn("[agent-share] Composer pill registration failed:", error);
    });

  console.log("[agent-share] contributions registered");

  return () => {
    disposed = true;
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch {
        // Ignore cleanup ordering issues on unload.
      }
    }
    for (const registration of pillRegistrations.values()) {
      registration.remove();
    }
    pillRegistrations.clear();
    if (subscription) void subscription.release();
  };
}
