# LFS Norisring AI track mod control

## Commands

- `/o light` - turn on headlights on N77 TRACK and blink extra lights on N77 TRACK 3 if it is present
- `/o extra` - turn on extra lights on N77 TRACK 2
- `/o start` - start sequence on N77 TRACK 2, and on N77 TRACK 3 if it is present
  - turn on rear fog lights after `config.ai.rearFogLightsOnDelay` seconds
  - turn off rear fog lights and turn on front fog lights after a random time between `config.ai.frontFogLightsOnDelayMin` and `config.ai.frontFogLightsOnDelayMax` seconds
- `/o roll` - show a rolling race start RCM for 6 seconds

## Features

- Pit lane speed limit with penalties
  - When going over the speed limit, the player is given a drive-through penalty
  - When going over the speed limit by more than 20 km/h, the player is given a stop & go penalty

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
