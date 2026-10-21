import { webcrypto } from "node:crypto";

// Polyfill globalThis.crypto for plugin host environments that lack it
// (e.g. bundled Node on Windows). fetch/undici requires it.
if (typeof (globalThis as any).crypto === "undefined") {
  (globalThis as any).crypto = webcrypto;
}

import type { PluginServerContext } from "@getpaseo/plugin/server";
import contribute from "./server/share-session";

export default function contributeWrapper(server: PluginServerContext) {
  return contribute(server);
}
