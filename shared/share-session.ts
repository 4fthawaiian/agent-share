import { z } from "zod";

export const shareSessionRpc = {
  name: "share",
  input: z.object({
    agentId: z.string(),
    direction: z.enum(["tail", "before", "after"]).optional(),
    limit: z.number().optional(),
    projection: z.enum(["projected", "canonical"]).optional(),
  }),
  output: z.object({
    url: z.string(),
    agentId: z.string(),
    title: z.string().nullable(),
    epoch: z.string(),
    direction: z.string(),
    projection: z.string(),
    hasOlder: z.boolean(),
    hasNewer: z.boolean(),
  }),
} as const;

export const startDeviceAuthRpc = {
  name: "auth",
  input: z.object({}),
  output: z.object({
    deviceCode: z.string(),
    userCode: z.string(),
    verificationUri: z.string(),
    expiresIn: z.number(),
    interval: z.number(),
  }),
} as const;

export const pollDeviceAuthRpc = {
  name: "poll",
  input: z.object({
    deviceCode: z.string(),
  }),
  output: z.object({
    success: z.boolean(),
    accessToken: z.string().optional(),
    error: z.string().optional(),
  }),
} as const;

export const setTokenRpc = {
  name: "token",
  input: z.object({
    token: z.string().min(1),
  }),
  output: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
} as const;

export type ShareSessionInput = z.infer<typeof shareSessionRpc.input>;
export type ShareSessionOutput = z.infer<typeof shareSessionRpc.output>;
export type StartDeviceAuthInput = z.infer<typeof startDeviceAuthRpc.input>;
export type StartDeviceAuthOutput = z.infer<typeof startDeviceAuthRpc.output>;
export type PollDeviceAuthInput = z.infer<typeof pollDeviceAuthRpc.input>;
export type PollDeviceAuthOutput = z.infer<typeof pollDeviceAuthRpc.output>;
export type SetTokenInput = z.infer<typeof setTokenRpc.input>;
export type SetTokenOutput = z.infer<typeof setTokenRpc.output>;
