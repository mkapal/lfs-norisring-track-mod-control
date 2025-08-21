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
  }),
  ai: z.object({
    rearFogLightsOnDelay: z.number().default(3000),
    extraLightsOffDelay: z.number().default(15000),
    frontFogLightsOnDelayMin: z.number().default(2000),
    frontFogLightsOnDelayMax: z.number().default(2000),
    track: z.string().min(0).max(24),
    track2: z.string().min(0).max(24),
  }),
  rcm: z.object({
    goMessageTimeout: z.number().default(3000),
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

  return config;
}
