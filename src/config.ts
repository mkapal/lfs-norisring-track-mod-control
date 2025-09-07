import * as path from "node:path";
import * as process from "node:process";

import chalk from "chalk";
import { z } from "zod";
import { loadConfigSync as loadZodConfig } from "zod-config";
import { tomlAdapter } from "zod-config/toml-adapter";

const configSchema = z.object({
  insim: z.object({
    host: z.string().min(1).optional().default("127.0.0.1"),
    port: z.number().min(1).max(65535),
    admin: z.string().min(0).max(16).optional().default(""),
    carPositionPacketInterval: z
      .number()
      .min(0)
      .max(10000)
      .optional()
      .default(100),
  }),
  general: z.object({
    pitLaneSpeedLimitKmh: z.number().min(0).max(1000).optional(),
  }),
  ai: z.object({
    rearFogLightsOnDelay: z.number().min(0).default(3000),
    frontFogLightsOnDelayMin: z.number().min(0).default(2000),
    frontFogLightsOnDelayMax: z.number().min(0).default(2000),
    track: z.string().min(0).max(24),
    track2: z.string().min(0).max(24),
    track3: z.string().min(0).max(24),
    track3BlinkTimeout: z.number().min(0).default(5000),
  }),
  rcm: z.object({
    goMessageTimeout: z.number().min(0).default(3000),
  }),
});

export function loadConfig() {
  const config = loadZodConfig({
    schema: configSchema,
    adapters: [
      tomlAdapter({
        path: path.join(process.cwd(), "config.toml"),
      }),
      tomlAdapter({
        path: path.join(process.cwd(), "config.local.toml"),
        silent: true,
      }),
    ],
    onError: (error) => {
      console.error(chalk.red("Error loading configuration:"));
      console.error(
        error.issues
          .map(({ path, message }) => `- ${path.join(" -> ")}: ${message}`)
          .join("\n"),
      );
      process.exit(1);
    },
  });

  console.log(chalk.green("Configuration loaded"));

  console.log(
    `- Car position packet interval: ${config.insim.carPositionPacketInterval} ms`,
  );

  if (config.general.pitLaneSpeedLimitKmh === undefined) {
    console.log("- Pit lane speed limit: disabled");
  } else {
    console.log(
      `- Pit lane speed limit: ${config.general.pitLaneSpeedLimitKmh} km/h`,
    );
  }

  return config;
}
