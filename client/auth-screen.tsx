import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  openExternalUrl,
  useRpc,
  useSettings,
  type PluginSurfaceProps,
} from "@getpaseo/plugin/client";
import { copyText, ScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import {
  ExternalLink,
  SettingsAction,
  SettingsCard,
  SettingsGroup,
  SettingsInput,
  SettingsRow,
} from "@getpaseo/plugin/client/ui";
import {
  agentShareSettings,
  pollDeviceAuthRpc,
  setTokenRpc,
  startDeviceAuthRpc,
  type StartDeviceAuthOutput,
} from "../shared/share-session";

type AuthPhase =
  | { kind: "idle" }
  | { kind: "awaiting"; auth: StartDeviceAuthOutput }
  | { kind: "error"; message: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthScreen({ theme }: PluginSurfaceProps) {
  const colors = theme.colors;
  const toast = useToast();
  const startAuth = useRpc(startDeviceAuthRpc);
  const pollAuth = useRpc(pollDeviceAuthRpc);
  const setToken = useRpc(setTokenRpc);
  const settings = useSettings(agentShareSettings);

  const [phase, setPhase] = useState<AuthPhase>({ kind: "idle" });
  const [manualToken, setManualToken] = useState("");
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const persistToken = async (token: string) => {
    await setToken({ token });
    const state = settingsRef.current;
    if (state.status === "ready" || state.status === "invalid") {
      await state.save({ githubToken: token }, state.revision);
    }
  };

  useEffect(() => {
    if (phase.kind !== "awaiting") return;
    const { auth } = phase;
    let cancelled = false;
    let interval = auth.interval;
    const deadline = Date.now() + auth.expiresIn * 1000;

    const poll = async () => {
      while (!cancelled && Date.now() < deadline) {
        await sleep(interval * 1000);
        try {
          const result = await pollAuth({ deviceCode: auth.deviceCode });
          if (result.success) {
            if (!result.accessToken) {
              if (!cancelled) setPhase({ kind: "error", message: "GitHub did not return a token." });
              return;
            }
            await persistToken(result.accessToken);
            if (!cancelled) {
              setPhase({ kind: "idle" });
              toast.show("GitHub connected — you can share sessions now.", { variant: "success" });
            }
            return;
          }
          if (result.error === "slow_down") {
            interval += 5;
            continue;
          }
          if (result.error && result.error !== "pending") {
            if (!cancelled) setPhase({ kind: "error", message: `GitHub said: ${result.error}` });
            return;
          }
        } catch (error) {
          if (!cancelled) {
            setPhase({
              kind: "error",
              message: error instanceof Error ? error.message : String(error),
            });
            return;
          }
        }
      }
      if (!cancelled) setPhase({ kind: "error", message: "Authorization timed out. Try again." });
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const beginDeviceAuth = async () => {
    try {
      const auth = await startAuth({});
      setPhase({ kind: "awaiting", auth });
    } catch (error) {
      setPhase({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const saveManualToken = async () => {
    const token = manualToken.trim();
    if (!token) return;
    try {
      await persistToken(token);
      setManualToken("");
      toast.show("GitHub token saved.", { variant: "success" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const disconnect = async () => {
    const state = settingsRef.current;
    if (state.status === "ready" || state.status === "invalid") {
      await state.save({ githubToken: null }, state.revision);
      toast.show("Disconnected from GitHub.");
    }
  };

  const connected =
    settings.status === "ready" && Boolean(settings.values.githubToken);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SettingsGroup title="GitHub Gist sharing">
        {connected ? (
          <SettingsCard>
            <SettingsRow
              label="Connected"
              hint="Sessions are shared as public GitHub Gists from this account."
            />
            <SettingsAction
              label="Disconnect"
              hint="Removes the stored token from this host."
              actionLabel="Disconnect"
              onPress={() => void disconnect()}
            />
          </SettingsCard>
        ) : (
          <SettingsCard>
            {phase.kind === "awaiting" ? (
              <>
                <SettingsRow
                  label="Enter this code on GitHub"
                  hint="It expires shortly — paste it on the activation page."
                />
                <View style={[styles.codeBox, { borderColor: colors.border, backgroundColor: colors.surface1 }]}>
                  <Text style={[styles.code, { color: colors.accent }]}>{phase.auth.userCode}</Text>
                </View>
                <SettingsAction
                  label="Copy code"
                  actionLabel="Copy"
                  onPress={() => {
                    void copyText(phase.kind === "awaiting" ? phase.auth.userCode : "").then(
                      () => toast.show("Code copied."),
                      () => toast.error("Copy failed."),
                    );
                  }}
                />
                <SettingsAction
                  label="Open GitHub activation page"
                  hint={phase.auth.verificationUri}
                  actionLabel="Open"
                  onPress={() => void openExternalUrl(phase.auth.verificationUri)}
                />
                <View style={styles.waiting}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={[styles.waitingText, { color: colors.foregroundMuted }]}>
                    Waiting for authorization…
                  </Text>
                </View>
                <SettingsAction
                  label="Cancel"
                  actionLabel="Cancel"
                  onPress={() => setPhase({ kind: "idle" })}
                />
              </>
            ) : (
              <>
                {phase.kind === "error" && (
                  <SettingsRow label="Authorization failed" error={phase.message} />
                )}
                <SettingsRow
                  label="Authorize with GitHub"
                  hint="Opens GitHub's device flow — no token copying needed."
                />
                <SettingsAction
                  label="Authorize"
                  actionLabel="Start"
                  onPress={() => void beginDeviceAuth()}
                />
              </>
            )}
          </SettingsCard>
        )}

        {!connected && (
          <SettingsCard>
            <SettingsInput
              label="Or paste a token"
              hint="A personal access token with the gist scope."
              placeholder="github_pat_…"
              secureTextEntry
              onChangeText={setManualToken}
            />
            <SettingsAction
              label="Save token"
              actionLabel="Save"
              disabled={!manualToken.trim()}
              onPress={() => void saveManualToken()}
            />
            <ExternalLink href="https://github.com/settings/tokens/new">
              Create a token on GitHub
            </ExternalLink>
          </SettingsCard>
        )}
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  codeBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    paddingVertical: 16,
  },
  code: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 4,
  },
  waiting: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 8,
  },
  waitingText: {
    fontSize: 13,
  },
});
