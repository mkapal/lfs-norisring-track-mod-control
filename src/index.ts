import chalk from "chalk";
import { InSim } from "node-insim";
import {
  AICHeadlights,
  AICInput,
  AICToggleValue,
  AIInputVal,
  InSimFlags,
  IS_AIC,
  IS_ISI_ReqI,
  IS_TINY,
  MessageSound,
  PacketType,
  PlayerType,
  TinyType,
  UserType,
} from "node-insim/packets";

import { loadConfig } from "./config";

const aiPLIDs: {
  N77_TRACK_2: number | null;
  N77_TRACK: number | null;
} = {
  N77_TRACK_2: null,
  N77_TRACK: null,
};

function clearAiPLIDs() {
  aiPLIDs.N77_TRACK_2 = null;
  aiPLIDs.N77_TRACK = null;
}

const config = loadConfig();

console.log(`Connecting to ${config.insim.host}:${config.insim.port}`);

const inSim = new InSim();
inSim.connect({
  IName: "Norisring AI",
  Host: config.insim.host,
  Port: config.insim.port,
  Admin: config.insim.admin,
  Flags: InSimFlags.ISF_LOCAL,
  ReqI: IS_ISI_ReqI.SEND_VERSION,
  Interval: 100,
});

inSim.on(PacketType.ISP_VER, (packet) => {
  if (packet.ReqI !== IS_ISI_ReqI.SEND_VERSION) {
    return;
  }

  console.log(
    chalk.green(`Connected to LFS ${packet.Product} ${packet.Version}`),
  );

  inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NPL }));
});

inSim.on(PacketType.ISP_ISM, (packet) => {
  if (packet.ReqI > 0) {
    return;
  }

  clearAiPLIDs();
  inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NPL }));
});

inSim.on(PacketType.ISP_TINY, (packet) => {
  if (packet.SubT === TinyType.TINY_CLR) {
    clearAiPLIDs();
  }
});

inSim.on(PacketType.ISP_NPL, (packet) => {
  if (packet.PType & PlayerType.AI && packet.PName === config.ai.track) {
    success(`Found N77 TRACK: ${config.ai.track}`);
    aiPLIDs.N77_TRACK = packet.PLID;
  }

  if (packet.PType & PlayerType.AI && packet.PName === config.ai.track2) {
    success(`Found N77 TRACK 2: ${config.ai.track2}`);
    aiPLIDs.N77_TRACK_2 = packet.PLID;
  }
});

inSim.on(PacketType.ISP_PLL, (packet) => {
  if (aiPLIDs.N77_TRACK === packet.PLID) {
    aiPLIDs.N77_TRACK = null;
  }

  if (aiPLIDs.N77_TRACK_2 === packet.PLID) {
    aiPLIDs.N77_TRACK_2 = null;
  }
});

inSim.on(PacketType.ISP_RST, () => {
  if (aiPLIDs.N77_TRACK === null) {
    error(
      `${config.ai.track}^1: Cannot turn on headlights - AI car was not found on track`,
    );
    return;
  }

  log(`${config.ai.track}^2: Turn on headlights`);

  inSim.send(
    new IS_AIC({
      PLID: aiPLIDs.N77_TRACK,
      Inputs: [
        new AIInputVal({
          Input: AICInput.CS_HEADLIGHTS,
          Value: AICHeadlights.LOW,
        }),
      ],
    }),
  );
});

inSim.on(PacketType.ISP_MSO, (packet) => {
  if (packet.UserType === UserType.MSO_O) {
    switch (packet.Msg) {
      case "light": {
        if (aiPLIDs.N77_TRACK === null) {
          error(
            `${config.ai.track}^1: Cannot turn on headlights - AI car was not found on track`,
          );
          return;
        }

        log(`${config.ai.track}^2: Turn on headlights`);

        inSim.send(
          new IS_AIC({
            PLID: aiPLIDs.N77_TRACK,
            Inputs: [
              new AIInputVal({
                Input: AICInput.CS_HEADLIGHTS,
                Value: AICHeadlights.LOW,
              }),
            ],
          }),
        );

        break;
      }

      case "extra":
        {
          if (aiPLIDs.N77_TRACK_2 === null) {
            error(
              `${config.ai.track2}^1: Cannot turn on extra lights - AI car was not found on track`,
            );
            return;
          }

          log(`${config.ai.track2}^8: Turn on extra lights`);

          inSim.send(
            new IS_AIC({
              PLID: aiPLIDs.N77_TRACK_2,
              Inputs: [
                new AIInputVal({
                  Input: AICInput.CS_FOGFRONT,
                  Value: AICToggleValue.SWITCH_OFF,
                }),
                new AIInputVal({
                  Input: AICInput.CS_FOGREAR,
                  Value: AICToggleValue.SWITCH_OFF,
                }),
                new AIInputVal({
                  Input: AICInput.CS_EXTRALIGHT,
                  Value: AICToggleValue.SWITCH_ON,
                }),
              ],
            }),
          );
        }
        break;

      case "start":
        {
          if (aiPLIDs.N77_TRACK_2 === null) {
            error(
              `${config.ai.track2}^2: Cannot initiate start sequence - AI car was not found on track`,
            );
            return;
          }

          inSim.send(
            new IS_AIC({
              PLID: aiPLIDs.N77_TRACK_2,
              Inputs: [
                new AIInputVal({
                  Input: AICInput.CS_FOGREAR,
                  Value: AICToggleValue.SWITCH_OFF,
                }),
                new AIInputVal({
                  Input: AICInput.CS_FOGFRONT,
                  Value: AICToggleValue.SWITCH_OFF,
                }),
              ],
            }),
          );
          inSim.sendMessage("/rcc_all");

          log(
            `${config.ai.track2}^8: Turning on rear fog lights in ${config.ai.rearFogLightsOnDelay / 1000} seconds`,
          );

          setTimeout(() => {
            if (aiPLIDs.N77_TRACK_2 === null) {
              error(
                `${config.ai.track2}^1: Cannot turn on rear fog lights - must first call /o extra`,
              );
              return;
            }

            log(`${config.ai.track2}^8: Turn on rear fog lights`);

            inSim.sendMessage("/rcm ^3GET READY");
            inSim.sendMessage("/rcm_all");
            inSim.send(
              new IS_AIC({
                PLID: aiPLIDs.N77_TRACK_2,
                Inputs: [
                  new AIInputVal({
                    Input: AICInput.CS_FOGREAR,
                    Value: AICToggleValue.SWITCH_ON,
                  }),
                ],
              }),
            );

            const frontFogLightsOnDelay = Math.round(
              Math.random() * config.ai.frontFogLightsOnDelayMax +
                config.ai.frontFogLightsOnDelayMin,
            );

            setTimeout(() => {
              if (aiPLIDs.N77_TRACK_2 === null) {
                error(
                  `${config.ai.track2}^1: Cannot turn off rear fog lights - must first call /o extra`,
                );
                return;
              }

              log(`${config.ai.track2}^8: Turn off rear fog lights`);
              log(`${config.ai.track2}^8: Turn on front fog lights`);

              inSim.send(
                new IS_AIC({
                  PLID: aiPLIDs.N77_TRACK_2,
                  Inputs: [
                    new AIInputVal({
                      Input: AICInput.CS_FOGREAR,
                      Value: AICToggleValue.SWITCH_OFF,
                    }),
                    new AIInputVal({
                      Input: AICInput.CS_FOGFRONT,
                      Value: AICToggleValue.SWITCH_ON,
                    }),
                  ],
                }),
              );

              inSim.sendMessage("/rcc_all");
              inSim.sendMessage("/rcm ^2GO");
              inSim.sendMessage("/rcm_all");

              setTimeout(() => {
                inSim.sendMessage("/rcc_all");
              }, config.rcm.goMessageTimeout);

              setTimeout(() => {
                if (aiPLIDs.N77_TRACK_2 === null) {
                  error(
                    `${config.ai.track2}^2: Cannot turn off extra lights - must first call /o extra`,
                  );
                  return;
                }

                log(`${config.ai.track2}^8: Turn off extra lights`);

                inSim.send(
                  new IS_AIC({
                    PLID: aiPLIDs.N77_TRACK_2,
                    Inputs: [
                      new AIInputVal({
                        Input: AICInput.CS_EXTRALIGHT,
                        Value: AICToggleValue.SWITCH_OFF,
                      }),
                    ],
                  }),
                );
              }, config.ai.extraLightsOffDelay);
            }, frontFogLightsOnDelay);
          }, config.ai.rearFogLightsOnDelay);
        }
        break;
      default:
        error(`Invalid command: ${packet.Msg}`);
    }
  }
});

function log(message: string) {
  console.log(message);
  inSim.sendLocalMessage(message, MessageSound.SND_SYSMESSAGE);
}

function success(message: string) {
  console.error(chalk.green(message));
  inSim.sendLocalMessage(`^2${message}`, MessageSound.SND_ERROR);
}

function error(message: string) {
  console.error(chalk.red(message));
  inSim.sendLocalMessage(`^1${message}`, MessageSound.SND_ERROR);
}

process.on("uncaughtException", (error) => {
  console.error(chalk.red(error));
});
