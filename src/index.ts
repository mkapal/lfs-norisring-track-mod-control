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
  PacketType,
  TinyType,
  UserType,
} from "node-insim/packets";

import { handleAiTrackIds } from "./aiTrackIds";
import { loadConfig } from "./config";
import { createLog } from "./log";
import { handlePitLaneSpeedLimit } from "./pitLaneSpeedLimit";
import { playerTracking } from "./playerTracking";
import { handleRaceState } from "./raceState";

const config = loadConfig();

console.log(`Connecting to ${config.insim.host}:${config.insim.port}`);

const inSim = new InSim();
inSim.connect({
  IName: "Norisring AI",
  Host: config.insim.host,
  Port: config.insim.port,
  Admin: config.insim.admin,
  Flags: InSimFlags.ISF_MCI | InSimFlags.ISF_LOCAL,
  ReqI: IS_ISI_ReqI.SEND_VERSION,
  Interval: config.insim.carPositionPacketInterval,
});

const log = createLog(inSim);

const aiPLIDs = handleAiTrackIds(inSim, {
  track1name: config.ai.track,
  track2name: config.ai.track2,
  track3name: config.ai.track3,
});

const raceState = handleRaceState(inSim);
const playersConnections = playerTracking(inSim);

let track3BlinkTimeout1: NodeJS.Timeout | null = null;
let track3BlinkTimeout2: NodeJS.Timeout | null = null;

function clearTrack3BlinkTimeouts() {
  if (track3BlinkTimeout1) {
    clearTimeout(track3BlinkTimeout1);
  }

  if (track3BlinkTimeout2) {
    clearTimeout(track3BlinkTimeout2);
  }
}

handlePitLaneSpeedLimit(
  inSim,
  config.general.pitLaneSpeedLimitKmh,
  playersConnections,
  raceState,
);

inSim.on(PacketType.ISP_VER, (packet) => {
  if (packet.ReqI !== IS_ISI_ReqI.SEND_VERSION) {
    return;
  }

  console.log(
    chalk.green(`Connected to LFS ${packet.Product} ${packet.Version}`),
  );
});

inSim.on(PacketType.ISP_PLL, (packet) => {
  if (packet.PLID === aiPLIDs.getTrack3()) {
    clearTrack3BlinkTimeouts();
  }
});

inSim.on(PacketType.ISP_PLP, (packet) => {
  if (packet.PLID === aiPLIDs.getTrack3()) {
    clearTrack3BlinkTimeouts();
  }
});

inSim.on(PacketType.ISP_TINY, (packet) => {
  if (packet.SubT === TinyType.TINY_REN) {
    clearTrack3BlinkTimeouts();
  }
});

inSim.on(PacketType.ISP_RST, () => {
  turnOnHeadlights();
  track3extraLightsBlink();
});

inSim.on(PacketType.ISP_MSO, (packet) => {
  if (packet.UserType === UserType.MSO_O) {
    switch (packet.Msg) {
      case "light": {
        turnOnHeadlights();
        track3extraLightsBlink();
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

          log.message(`${config.ai.track2}^8: Turn on extra lights`);

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
          const track3PLID = aiPLIDs.getTrack3();

          const name = track3PLID ? config.ai.track3 : config.ai.track2;

          if (track2PLID === null) {
            log.error(
              `${name}^2: Cannot initiate start sequence - track 2 car was not found on track`,
            );
            return;
          }

          const PLID = track3PLID ?? track2PLID;

          inSim.send(
            new IS_AIC({
              PLID,
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

          log.message(
            `${name}^8: Turning on rear fog lights in ${config.ai.rearFogLightsOnDelay / 1000} seconds`,
          );

          setTimeout(() => {
            const track2PLID = aiPLIDs.getTrack2();
            const track3PLID = aiPLIDs.getTrack3();

            const name = track3PLID ? config.ai.track3 : config.ai.track2;

            if (track2PLID === null) {
              log.error(
                `${name}^1: Cannot turn on rear fog lights - must first call /o extra`,
              );
              return;
            }

            const PLID = track3PLID ?? track2PLID;

            log.message(`${name}^8: Turn on rear fog lights`);

            inSim.sendMessage("/rcm ^3GET READY");
            inSim.sendMessage("/rcm_all");
            inSim.send(
              new IS_AIC({
                PLID,
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
              const track3PLID = aiPLIDs.getTrack3();

              const name = track3PLID ? config.ai.track3 : config.ai.track2;

              if (track2PLID === null) {
                log.error(
                  `${name}^1: Cannot turn off rear fog lights - must first call /o extra`,
                );
                return;
              }

              log.message(`${name}^8: Turn off rear fog lights`);
              log.message(`${name}^8: Turn on front fog lights`);

              inSim.send(
                new IS_AIC({
                  PLID,
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

function turnOnHeadlights() {
  const trackPLID = aiPLIDs.getTrack1();
  if (trackPLID === null) {
    log.error(
      `${config.ai.track}^1: Cannot turn on headlights - track car was not found on track`,
    );
    return;
  }

  const track3PLID = aiPLIDs.getTrack3();
  if (track3PLID === null) {
    log.error(
      `${config.ai.track}^1: Cannot turn on headlights - track 3 car was not found on track`,
    );
    return;
  }

  log.debug(`${config.ai.track}^8: Turn on headlights`);
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

  log.debug(`${config.ai.track3}^8: Turn on headlights`);
  inSim.send(
    new IS_AIC({
      PLID: track3PLID,
      Inputs: [
        new AIInputVal({
          Input: AICInput.CS_HEADLIGHTS,
          Value: AICHeadlights.LOW,
        }),
      ],
    }),
  );
}

function track3extraLightsBlink() {
  clearTrack3BlinkTimeouts();

  const track3PLID = aiPLIDs.getTrack3();
  if (track3PLID === null) {
    log.debug(
      `${config.ai.track3}^1: Cannot turn on extra lights on track 3 - car was not found on track`,
    );
    return;
  }

  log.debug(`${config.ai.track3}^8: Turn on extra lights`);
  inSim.send(
    new IS_AIC({
      PLID: track3PLID,
      Inputs: [
        new AIInputVal({
          Input: AICInput.CS_EXTRALIGHT,
          Value: AICToggleValue.SWITCH_ON,
        }),
      ],
    }),
  );

  track3BlinkTimeout1 = setTimeout(() => {
    log.debug(`${config.ai.track3}^8: Turn off extra lights`);
    inSim.send(
      new IS_AIC({
        PLID: track3PLID,
        Inputs: [
          new AIInputVal({
            Input: AICInput.CS_EXTRALIGHT,
            Value: AICToggleValue.SWITCH_OFF,
          }),
        ],
      }),
    );

    track3BlinkTimeout2 = setTimeout(() => {
      track3extraLightsBlink();
    }, config.ai.track3BlinkTimeout);
  }, config.ai.track3BlinkTimeout);
}
