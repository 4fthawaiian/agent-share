import { z } from "zod";
import type { PluginServerContext, PluginHandlerContext } from "@getpaseo/plugin/server";
import { 
  shareSessionRpc, 
  startDeviceAuthRpc, 
  pollDeviceAuthRpc,
  setTokenRpc,
  type ShareSessionInput, 
  type ShareSessionOutput,
  type StartDeviceAuthInput,
  type StartDeviceAuthOutput,
  type PollDeviceAuthInput,
  type PollDeviceAuthOutput,
  type SetTokenInput,
  type SetTokenOutput,
} from "../shared/share-session";

// GitHub OAuth App - Device Authorization Flow
const DEFAULT_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "Ov23liDRprTwkEUGTUWe";

function timelineItemToMarkdown(item: any): string {
  const { item: timelineItem, timestamp, provider } = item;
  const time = new Date(timestamp).toLocaleString();

  switch (timelineItem.type) {
    case "user_message": {
      const messageId = timelineItem.messageId ? ` (${timelineItem.messageId})` : "";
      return `> **User**${messageId} *${time}*\n>\n> ${timelineItem.text.split("\n").join("\n> ")}\n`;
    }
    case "assistant_message": {
      const messageId = timelineItem.messageId ? ` (${timelineItem.messageId})` : "";
      return `**Assistant (${provider})**${messageId} *${time}*\n\n${timelineItem.text}\n`;
    }
    case "reasoning": {
      return `> **Reasoning (${provider})** *${time}*\n>\n> ${timelineItem.text.split("\n").join("\n> ")}\n`;
    }
    case "todo": {
      const items = timelineItem.items.map((t: { text: string; completed: boolean }) => `- [${t.completed ? "x" : " "}] ${t.text}`).join("\n");
      return `**Todo (${provider})** *${time}*\n\n${items}\n`;
    }
    case "error": {
      return `> **Error (${provider})** *${time}*\n>\n> ${timelineItem.message}\n`;
    }
    case "compaction": {
      return `> **Compaction (${provider})** *${time}* — ${timelineItem.status}${timelineItem.trigger ? ` (${timelineItem.trigger})` : ""}${timelineItem.preTokens ? `, ${timelineItem.preTokens} tokens` : ""}\n`;
    }
    case "tool_call": {
      const status = timelineItem.status;
      const callId = timelineItem.callId.slice(0, 8);
      const detail = timelineItem.detail;

      let detailMarkdown = "";
      switch (detail.type) {
        case "shell": {
          detailMarkdown = `\`\`\`bash\n${detail.command}\n\`\`\``;
          if (detail.cwd) detailMarkdown += `\n*cwd: ${detail.cwd}*`;
          if (detail.output) detailMarkdown += `\n\n\`\`\`\n${detail.output}\n\`\`\``;
          if (detail.exitCode !== undefined && detail.exitCode !== null) detailMarkdown += `\n*Exit code: ${detail.exitCode}*`;
          break;
        }
        case "read": {
          detailMarkdown = `**Read:** \`${detail.filePath}\``;
          if (detail.offset !== undefined || detail.limit !== undefined) {
            detailMarkdown += ` (offset: ${detail.offset ?? 0}, limit: ${detail.limit ?? "all"})`;
          }
          if (detail.content) detailMarkdown += `\n\n\`\`\`\n${detail.content}\n\`\`\``;
          break;
        }
        case "edit": {
          detailMarkdown = `**Edit:** \`${detail.filePath}\``;
          if (detail.unifiedDiff) {
            detailMarkdown += `\n\n\`\`\`diff\n${detail.unifiedDiff}\n\`\`\``;
          } else if (detail.oldString && detail.newString) {
            detailMarkdown += `\n\n\`\`\`diff\n- ${detail.oldString}\n+ ${detail.newString}\n\`\`\``;
          }
          break;
        }
        case "write": {
          detailMarkdown = `**Write:** \`${detail.filePath}\``;
          if (detail.content) detailMarkdown += `\n\n\`\`\`\n${detail.content}\n\`\`\``;
          break;
        }
        case "search": {
          detailMarkdown = `**Search:** ${detail.query}`;
          if (detail.toolName) detailMarkdown += ` (${detail.toolName})`;
          if (detail.content) detailMarkdown += `\n\n\`\`\`\n${detail.content}\n\`\`\``;
          if (detail.filePaths?.length) detailMarkdown += `\n*Files: ${detail.filePaths.join(", ")}*`;
          if (detail.webResults?.length) {
            detailMarkdown += "\n*Web results:*";
            for (const result of detail.webResults) {
              detailMarkdown += `\n- [${result.title}](${result.url})`;
            }
          }
          break;
        }
        case "fetch": {
          detailMarkdown = `**Fetch:** ${detail.url}`;
          if (detail.prompt) detailMarkdown += `\n*Prompt: ${detail.prompt}*`;
          if (detail.result) detailMarkdown += `\n\n\`\`\`\n${detail.result}\n\`\`\``;
          if (detail.code !== undefined) detailMarkdown += `\n*HTTP ${detail.code}*`;
          break;
        }
        case "worktree_setup": {
          detailMarkdown = `**Worktree Setup:** \`${detail.worktreePath}\` (branch: ${detail.branchName})`;
          if (detail.log) detailMarkdown += `\n\n\`\`\`\n${detail.log}\n\`\`\``;
          break;
        }
        case "sub_agent": {
          detailMarkdown = `**Sub-agent:** ${detail.subAgentType ?? "unknown"}`;
          if (detail.description) detailMarkdown += ` — ${detail.description}`;
          if (detail.log) detailMarkdown += `\n\n\`\`\`\n${detail.log}\n\`\`\``;
          break;
        }
        case "plain_text": {
          detailMarkdown = detail.label ? `**${detail.label}**` : "**Tool Call**";
          if (detail.text) detailMarkdown += `\n\n${detail.text}`;
          break;
        }
        case "plan": {
          detailMarkdown = `**Plan**\n\n${detail.text}`;
          break;
        }
        case "unknown": {
          detailMarkdown = `**Unknown Tool Call: ${timelineItem.name}**\n\n\`\`\`json\n${JSON.stringify(detail.input, null, 2)}\n\`\`\`\n\n**Output:**\n\n\`\`\`json\n${JSON.stringify(detail.output, null, 2)}\n\`\`\``;
          break;
        }
      }

      let statusEmoji: string;
      if (status === "running") statusEmoji = "🔄";
      else if (status === "completed") statusEmoji = "✅";
      else if (status === "failed") statusEmoji = "❌";
      else statusEmoji = "⏹️";

      const errorMarkdown = timelineItem.error ? `\n> **Error:** ${JSON.stringify(timelineItem.error)}` : "";

      return `${statusEmoji} **${timelineItem.name}** (${callId}) *${time}*\n\n${detailMarkdown}${errorMarkdown}\n`;
    }
    default: {
      return `> **Unknown item type** *${time}*\n>\n> \`\`\`json\n${JSON.stringify(timelineItem, null, 2)}\n\`\`\`\n`;
    }
  }
}

function agentSnapshotToMarkdown(agent: any): string {
  if (!agent) return "";
  const lines: string[] = [];
  lines.push(`# Agent Session: ${agent.title ?? agent.id}`);
  lines.push("");
  lines.push(`- **ID:** \`${agent.id}\``);
  lines.push(`- **Provider:** ${agent.provider}`);
  lines.push(`- **Status:** ${agent.status}`);
  if (agent.cwd) lines.push(`- **Working Directory:** \`${agent.cwd}\``);
  if (agent.model) lines.push(`- **Model:** ${agent.model}`);
  if (agent.currentModeId) lines.push(`- **Mode:** ${agent.currentModeId}`);
  if (agent.thinkingOptionId) lines.push(`- **Thinking:** ${agent.thinkingOptionId}`);
  if (agent.createdAt) lines.push(`- **Created:** ${new Date(agent.createdAt).toLocaleString()}`);
  if (agent.updatedAt) lines.push(`- **Updated:** ${new Date(agent.updatedAt).toLocaleString()}`);
  if (agent.archivedAt) lines.push(`- **Archived:** ${new Date(agent.archivedAt).toLocaleString()}`);
  lines.push("");
  return lines.join("\n");
}

async function generateMarkdown(paseo: any, input: ShareSessionInput): Promise<{ markdown: string; timeline: any }> {
  console.log("[chat-share] Fetching timeline for agent:", input.agentId);
  const timeline = await paseo.agents.ref(input.agentId).timeline.refetch({
    direction: input.direction ?? "tail",
    limit: input.limit,
    projection: input.projection ?? "projected",
  });

  if (!timeline) {
    throw new Error(`Agent ${input.agentId} not found or has no timeline`);
  }

  console.log("[chat-share] Timeline fetched, entries:", timeline.entries.length);

  let markdown = "";
  if (timeline.agent) {
    markdown += agentSnapshotToMarkdown(timeline.agent);
  }

  if (timeline.entries.length === 0) {
    markdown += "> *No timeline entries found.*\n";
  } else {
    markdown += "## Timeline\n\n";
    for (const entry of timeline.entries) {
      markdown += timelineItemToMarkdown(entry);
      markdown += "\n---\n\n";
    }
  }

  markdown += "---\n\n";
  markdown += `*Exported from Paseo daemon on ${new Date().toLocaleString()}*\n`;
  markdown += `*Agent ID: \`${input.agentId}\`, Epoch: \`${timeline.epoch}\`, Direction: \`${timeline.direction}\`, Projection: \`${timeline.projection}\`*\n`;
  if (timeline.hasOlder) {
    markdown += `*Has older entries: yes*\n`;
  }
  if (timeline.hasNewer) {
    markdown += `*Has newer entries: yes*\n`;
  }

  return { markdown, timeline };
}

async function createGist(markdown: string, title: string, token: string): Promise<string> {
  const response = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "paseo-agent-share",
    },
    body: JSON.stringify({
      description: title,
      public: true,
      files: {
        "session.md": { content: markdown },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 401) {
      throw new Error("Invalid GitHub token. Run setup again.");
    }
    throw new Error(`Failed to create gist: ${response.status} ${error}`);
  }

  const gist = await response.json();
  return gist.html_url;
}

// In-memory token storage
let githubToken: string | null = null;

async function handleShareSession(input: ShareSessionInput, context: PluginHandlerContext): Promise<ShareSessionOutput> {
  console.log("[chat-share] Handling share-session for agent:", input.agentId);
  const { markdown, timeline } = await generateMarkdown(context.paseo, input);

  if (!githubToken) {
    throw new Error("GitHub token not configured. Run 'Setup GitHub Gist sharing' from Command Center first.");
  }

  const title = timeline.agent?.title ?? `Agent ${input.agentId}`;
  const gistUrl = await createGist(markdown, title, githubToken);
  console.log("[chat-share] Published to:", gistUrl);

  return {
    url: gistUrl,
    agentId: input.agentId,
    title: timeline.agent?.title ?? null,
    epoch: timeline.epoch,
    direction: timeline.direction,
    projection: timeline.projection,
    hasOlder: timeline.hasOlder,
    hasNewer: timeline.hasNewer,
  };
}

async function handleStartDeviceAuth(input: StartDeviceAuthInput, context: PluginHandlerContext): Promise<StartDeviceAuthOutput> {
  const clientId = DEFAULT_CLIENT_ID;
  
  if (!clientId) {
    throw new Error("GitHub client_id not configured.");
  }
  
  console.log("[chat-share] Starting GitHub device authorization with client_id:", clientId);
  
  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      scope: "gist",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to start device auth: ${response.status} ${error}`);
  }

  const data = await response.json();
  console.log("[chat-share] Device code:", data.device_code, "User code:", data.user_code);
  
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    expiresIn: data.expires_in,
    interval: data.interval,
  };
}

async function handlePollDeviceAuth(input: PollDeviceAuthInput, context: PluginHandlerContext): Promise<PollDeviceAuthOutput> {
  const clientId = DEFAULT_CLIENT_ID;
  
  if (!clientId) {
    throw new Error("GitHub client_id not configured.");
  }
  
  console.log("[chat-share] Polling device authorization for:", input.deviceCode);
  
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      device_code: input.deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to poll device auth: ${response.status} ${error}`);
  }

  const data = await response.json();
  
  if (data.error) {
    if (data.error === "authorization_pending") {
      return { success: false, error: "pending" };
    }
    if (data.error === "slow_down") {
      return { success: false, error: "slow_down" };
    }
    return { success: false, error: data.error };
  }
  
  if (data.access_token) {
    githubToken = data.access_token;
    console.log("[chat-share] Authorization successful, token stored");
    return { success: true, accessToken: data.access_token };
  }
  
  return { success: false, error: "unknown" };
}

async function handleSetToken(input: SetTokenInput, context: PluginHandlerContext): Promise<SetTokenOutput> {
  console.log("[chat-share] Storing manual GitHub token");
  githubToken = input.token;
  return { success: true, message: "GitHub token saved. You can now share sessions." };
}

export default function contribute(server: PluginServerContext) {
  server.handle(shareSessionRpc, handleShareSession);
  server.handle(startDeviceAuthRpc, handleStartDeviceAuth);
  server.handle(pollDeviceAuthRpc, handlePollDeviceAuth);
  server.handle(setTokenRpc, handleSetToken);
  return () => {};
}
