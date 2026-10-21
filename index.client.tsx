import type { PluginClientContext, PluginAgentCommandContext } from "@getpaseo/plugin/client";
import { Platform } from "react-native";
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
} from "./shared/share-session";

async function copyToClipboard(text: string): Promise<void> {
  if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as any).clipboard) {
    await (navigator as any).clipboard.writeText(text);
  }
}

export default function contribute(client: PluginClientContext) {
  // Setup command with GitHub Device Authorization Flow (fallback to manual token)
  client.addCommandCenterItem({
    id: "chat-share-setup",
    title: "Setup GitHub Gist sharing",
    icon: "Settings",
    context: "global",
    async onSelect(ctx: any) {
      try {
        // Try device auth first with default client_id
        const authResult = await ctx.rpc(startDeviceAuthRpc, {} as StartDeviceAuthInput);
        
        // Copy code to clipboard
        await copyToClipboard(authResult.userCode);
        
        const message = `Code copied to clipboard!\n\nEnter this code on GitHub:\n\n${authResult.userCode}\n\nOpening GitHub authorization page...`;
        (globalThis as any).alert(message);
        
        if (Platform.OS === "web") {
          (globalThis as any).window?.open(authResult.verificationUri, "_blank");
        } else {
          (globalThis as any).alert("Please visit this URL to authorize:\n" + authResult.verificationUri);
        }
        
        const interval = authResult.interval * 1000;
        const maxAttempts = (authResult.expiresIn / authResult.interval) - 5;
        let attempts = 0;
        
        (globalThis as any).alert("Waiting for authorization...");
        
        while (attempts < maxAttempts) {
          try {
            await new Promise(resolve => setTimeout(resolve, interval));
            
            const pollResult = await ctx.rpc(pollDeviceAuthRpc, { deviceCode: authResult.deviceCode } as PollDeviceAuthInput);
            
            if (pollResult.success) {
              (globalThis as any).alert("GitHub authorization successful! You can now share sessions.");
              return;
            }
            
            if (pollResult.error === "slow_down") {
              await new Promise(resolve => setTimeout(resolve, interval));
            }
            
            if (pollResult.error && pollResult.error !== "pending" && pollResult.error !== "slow_down") {
              // Device auth failed, offer manual token fallback
              const tryManual = (globalThis as any).confirm(
                `Device authorization failed: ${pollResult.error}\n\nTry manual token entry instead?`
              );
              
              if (tryManual) {
                const token = (globalThis as any).prompt(
                  "Paste your GitHub personal access token (with gist scope):\n\nCreate one at https://github.com/settings/tokens/new"
                );
                
                if (!token) {
                  (globalThis as any).alert("Setup cancelled.");
                  return;
                }
                
                const result = await ctx.rpc(setTokenRpc, { token } as SetTokenInput);
                (globalThis as any).alert(result.message);
              }
              return;
            }
          } catch (pollError) {
            // If plugin was reloaded or stopped during polling, offer manual token
            const errorMsg = pollError instanceof Error ? pollError.message : String(pollError);
            if (errorMsg.includes("closed") || errorMsg.includes("IPC")) {
              const tryManual = (globalThis as any).confirm(
                "Plugin was reloaded during authorization. Try manual token entry instead?"
              );
              
              if (tryManual) {
                const token = (globalThis as any).prompt(
                  "Paste your GitHub personal access token (with gist scope):\n\nCreate one at https://github.com/settings/tokens/new"
                );
                
                if (!token) {
                  (globalThis as any).alert("Setup cancelled.");
                  return;
                }
                
                try {
                  const result = await ctx.rpc(setTokenRpc, { token } as SetTokenInput);
                  (globalThis as any).alert(result.message);
                } catch (tokenError) {
                  (globalThis as any).alert(`Token setup failed: ${tokenError instanceof Error ? tokenError.message : String(tokenError)}`);
                }
              }
              return;
            }
            throw pollError;
          }
          
          attempts++;
        }
        
        (globalThis as any).alert("Authorization timed out. Please try again.");
      } catch (error) {
        console.error("[chat-share] Setup failed:", error);
        
        // If device auth fails completely, offer manual token
        const tryManual = (globalThis as any).confirm(
          `Setup failed: ${error instanceof Error ? error.message : String(error)}\n\nTry manual token entry instead?`
        );
        
        if (tryManual) {
          const token = (globalThis as any).prompt(
            "Paste your GitHub personal access token (with gist scope):\n\nCreate one at https://github.com/settings/tokens/new"
          );
          
          if (!token) {
            (globalThis as any).alert("Setup cancelled.");
            return;
          }
          
          try {
            const result = await ctx.rpc(setTokenRpc, { token } as SetTokenInput);
            (globalThis as any).alert(result.message);
          } catch (tokenError) {
            (globalThis as any).alert(`Token setup failed: ${tokenError instanceof Error ? tokenError.message : String(tokenError)}`);
          }
        }
      }
    },
  });

  // Share command
  client.addCommandCenterItem({
    id: "share-session",
    title: "Share session as Markdown",
    icon: "FileText",
    context: "agent",
    async onSelect(ctx: PluginAgentCommandContext) {
      try {
        const result = await ctx.rpc(shareSessionRpc, { agentId: ctx.agent.id } as ShareSessionInput);
        console.log("[chat-share] Shared to:", result.url);
        await copyToClipboard(result.url);
        (globalThis as any).alert(`Shared! URL copied to clipboard:\n${result.url}`);
      } catch (error) {
        console.error("[chat-share] Share failed:", error);
        (globalThis as any).alert(`Share failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  });

  console.log("[chat-share] Command Center items registered");

  return () => {};
}
