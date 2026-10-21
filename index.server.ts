import type { PluginServerContext } from "@getpaseo/plugin/server";
import contribute from "./server/share-session";
import { shareSessionRpc } from "./shared/share-session";

export default function contributeWrapper(server: PluginServerContext) {
  return contribute(server);
}