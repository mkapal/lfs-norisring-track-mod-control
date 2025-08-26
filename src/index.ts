import chalk from "chalk";

import { handleAiTrackIds } from "./aiTrackIds";
import { loadConfig } from "./config";
import { InSim } from "./libs/node-insim";
import {
  AICHeadlights,
  AICInput,
  AICToggleValue,
  AIInputVal,
  InSimFlags,
  IS_AIC,
  IS_ISI_ReqI,
  PacketType,
  UserType,
} from "./libs/node-insim/packets";
import { createLog } from "./log";

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

const log = createLog(inSim);

const aiPLIDs = handleAiTrackIds(inSim, {
  track1name: config.ai.track,
  track2name: config.ai.track2,
});

inSim.on(PacketType.ISP_VER, (packet) => {
  if (packet.ReqI !== IS_ISI_ReqI.SEND_VERSION) {
    return;
  }

  console.log(
    chalk.green(`Connected to LFS ${packet.Product} ${packet.Version}`),
  );
});

inSim.on(PacketType.ISP_RST, () => {
  const trackPLID = aiPLIDs.getTrack1();

  if (trackPLID === null) {
    log.error(
      `${config.ai.track}^1: Cannot turn on headlights - AI car was not found on track`,
    );
    return;
  }

  log.log(`${config.ai.track}^2: Turn on headlights`);

  inSim.send(
    new IS_AIC({
      PLID: trackPLID,
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
        const trackPLID = aiPLIDs.getTrack1();
        if (trackPLID === null) {
          log.error(
            `${config.ai.track}^1: Cannot turn on headlights - AI car was not found on track`,
          );
          return;
        }

        log.log(`${config.ai.track}^2: Turn on headlights`);

        inSim.send(
          new IS_AIC({
            PLID: trackPLID,
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
          const track2PLID = aiPLIDs.getTrack2();

          if (track2PLID === null) {
            log.error(
              `${config.ai.track2}^1: Cannot turn on extra lights - AI car was not found on track`,
            );
            return;
          }

          log.log(`${config.ai.track2}^8: Turn on extra lights`);

          inSim.send(
            new IS_AIC({
              PLID: track2PLID,
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
          const track2PLID = aiPLIDs.getTrack2();

          if (track2PLID === null) {
            log.error(
              `${config.ai.track2}^2: Cannot initiate start sequence - AI car was not found on track`,
            );
            return;
          }

          inSim.send(
            new IS_AIC({
              PLID: track2PLID,
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

          log.log(
            `${config.ai.track2}^8: Turning on rear fog lights in ${config.ai.rearFogLightsOnDelay / 1000} seconds`,
          );

          setTimeout(() => {
            const track2PLID = aiPLIDs.getTrack2();

            if (track2PLID === null) {
              log.error(
                `${config.ai.track2}^1: Cannot turn on rear fog lights - must first call /o extra`,
              );
              return;
            }

            log.log(`${config.ai.track2}^8: Turn on rear fog lights`);

            inSim.sendMessage("/rcm ^3GET READY");
            inSim.sendMessage("/rcm_all");
            inSim.send(
              new IS_AIC({
                PLID: track2PLID,
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
              const track2PLID = aiPLIDs.getTrack2();

              if (track2PLID === null) {
                log.error(
                  `${config.ai.track2}^1: Cannot turn off rear fog lights - must first call /o extra`,
                );
                return;
              }

              log.log(`${config.ai.track2}^8: Turn off rear fog lights`);
              log.log(`${config.ai.track2}^8: Turn on front fog lights`);

              inSim.send(
                new IS_AIC({
                  PLID: track2PLID,
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
                const track2PLID = aiPLIDs.getTrack2();

                if (track2PLID === null) {
                  log.error(
                    `${config.ai.track2}^2: Cannot turn off extra lights - must first call /o extra`,
                  );
                  return;
                }

                log.log(`${config.ai.track2}^8: Turn off extra lights`);

                inSim.send(
                  new IS_AIC({
                    PLID: track2PLID,
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
        log.error(`Invalid command: ${packet.Msg}`);
    }
  }
});

process.on("uncaughtException", (error) => {
  console.error(chalk.red(error));
});
