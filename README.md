# LFS Norisring AI track mod control

## Commands

- `/o light` - turn on headlights
- `/o extra` - turn on extra lights
- `/o start` - start sequence
  - turn on rear fog lights after `config.ai.rearFogLightsOnDelay` seconds
  - turn off rear fog lights and turn on front fog lights after a random time between `config.ai.frontFogLightsOnDelayMin` and `config.ai.frontFogLightsOnDelayMax` seconds
  - turn off extra lights after `config.ai.extraLightsOffDelay`

## Requirements

- [Node.js](https://nodejs.org/) 20

## Installation

```shell
corepack enable
pnpm install
```

## Development build

```shell
pnpm dev
```

The app connects to `127.0.0.1:29999` by default.

## Production build

```shell
pnpm build
```

## Development

### Custom configuration

Copy `config.toml` to `config.local.toml`, it will take precedence.
