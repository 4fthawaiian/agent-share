import { Pressable, StyleSheet, Text, View } from "react-native";
import { openExternalUrl, type PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/react-native";
import type { ShareResultData } from "../shared/share-session";

export function ShareResultCard({ item, theme }: PluginTimelineItemProps<ShareResultData>) {
  const colors = theme.colors;
  const data = item.data;

  if (data.status === "failed") {
    return (
      <View style={[styles.card, { borderColor: colors.statusDanger, backgroundColor: colors.surface1 }]}>
        <Icon name="AlertCircle" size={16} color={colors.statusDanger} />
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.statusDanger }]}>Share failed</Text>
          <Text style={[styles.detail, { color: colors.foregroundMuted }]} numberOfLines={3}>
            {data.error ?? "Unknown error"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => data.url && void openExternalUrl(data.url)}
      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface1 }]}
    >
      <Icon name="Share2" size={16} color={colors.accent} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]}>Session shared to GitHub Gist</Text>
        <Text style={[styles.detail, { color: colors.accent }]} numberOfLines={1}>
          {data.url}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 2,
  },
  card: {
    alignItems: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  detail: {
    fontSize: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
  },
});
