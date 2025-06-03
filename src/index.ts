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
  MessageSound,
  PacketType,
  UserType,
} from "node-insim/packets";

import { loadConfig } from "./config";

(async function () {
  const config = await loadConfig();

  console.log(`Connecting to ${config.insim.host}:${config.insim.port}`);

  const inSim = new InSim();
  inSim.connect({
    IName: "AI lights",
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

    console.log(chalk.green("Connected to LFS"));
  });

  const state: {
    viewPLID: number | null;
    aiControlPLID: number | null;
  } = {
    viewPLID: null,
    aiControlPLID: null,
  };

  inSim.on(PacketType.ISP_STA, (packet) => {
    if (packet.ViewPLID !== state.viewPLID) {
      console.log(`View PLID: ${packet.ViewPLID}`);
      state.viewPLID = packet.ViewPLID;
    }
  });

  inSim.on(PacketType.ISP_MSO, (packet) => {
    if ((packet.UserType & UserType.MSO_O) !== 0) {
      switch (packet.Msg) {
        case "ai": {
          state.aiControlPLID = state.viewPLID;
          console.log(`Set AI control to PLID ${state.aiControlPLID}`);
          inSim.sendLocalMessage(
            `AIC: Set AI control to PLID ${state.aiControlPLID}`,
            MessageSound.SND_SYSMESSAGE,
          );

          break;
        }

        case "light": {
          if (state.aiControlPLID === null) {
            inSim.sendLocalMessage(
              "^1Cannot turn on headlights - first type /o ai when viewing an AI car",
              MessageSound.SND_ERROR,
            );
            return;
          }

          console.log("Turn on headlights");
          inSim.sendLocalMessage(
            "AIC: Turn on headlights",
            MessageSound.SND_SYSMESSAGE,
          );

          inSim.send(
            new IS_AIC({
              PLID: state.aiControlPLID,
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
            if (state.aiControlPLID === null) {
              inSim.sendLocalMessage(
                "^1Cannot turn on headlights - first type /o ai when viewing an AI car",
                MessageSound.SND_ERROR,
              );
              return;
            }

            console.log("Turn on extra lights");
            inSim.sendLocalMessage(
              "AIC: Turn on extra lights",
              MessageSound.SND_SYSMESSAGE,
            );

            inSim.send(
              new IS_AIC({
                PLID: state.aiControlPLID,
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
            if (state.aiControlPLID === null) {
              inSim.sendLocalMessage(
                "^1Cannot initiate start sequence - first type /o ai when viewing an AI car",
                MessageSound.SND_ERROR,
              );
              return;
            }

            console.log(
              `Turning on rear fog lights in ${config.ai.extraLightsOnDelay / 1000} seconds`,
            );
            inSim.sendLocalMessage(
              `AIC: Turning on rear fog lights in ${config.ai.extraLightsOnDelay / 1000} seconds`,
              MessageSound.SND_SYSMESSAGE,
            );

            setTimeout(() => {
              if (state.aiControlPLID === null) {
                inSim.sendLocalMessage(
                  "^1Cannot turn on rear fog lights - must first call /o extra when viewing an AI car",
                  MessageSound.SND_ERROR,
                );
                return;
              }

              console.log("Turn on rear fog lights");
              inSim.sendLocalMessage(
                "AIC: Turn on rear fog lights",
                MessageSound.SND_SYSMESSAGE,
              );

              inSim.send(
                new IS_AIC({
                  PLID: state.aiControlPLID,
                  Inputs: [
                    new AIInputVal({
                      Input: AICInput.CS_FOGREAR,
                      Value: AICToggleValue.SWITCH_ON,
                    }),
                  ],
                }),
              );

              const frontFogLightsOnDelay = Math.round(
                Math.random() * 2000 + 2000,
              );

              setTimeout(() => {
                if (state.aiControlPLID === null) {
                  inSim.sendLocalMessage(
                    "^1Cannot turn off rear fog lights - must first call /o extra when viewing an AI car",
                    MessageSound.SND_ERROR,
                  );
                  return;
                }

                console.log("Turn off rear fog lights");
                console.log("Turn on front fog lights");
                inSim.sendLocalMessage(
                  "AIC: Turn on rear fog lights & turn on front fog lights",
                  MessageSound.SND_SYSMESSAGE,
                );

                inSim.send(
                  new IS_AIC({
                    PLID: state.aiControlPLID,
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

                setTimeout(() => {
                  if (state.aiControlPLID === null) {
                    inSim.sendLocalMessage(
                      "^1Cannot turn off extra lights - must first call /o extra when viewing an AI car",
                      MessageSound.SND_ERROR,
                    );
                    return;
                  }

                  console.log("Turn off extra lights");
                  inSim.sendLocalMessage(
                    "AIC: Turn off extra lights",
                    MessageSound.SND_SYSMESSAGE,
                  );

                  inSim.send(
                    new IS_AIC({
                      PLID: state.aiControlPLID,
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
            }, config.ai.extraLightsOnDelay);
          }
          break;
        default:
          console.log(chalk.yellow(`Invalid command: ${packet.Msg}`));
      }
    }
  });
})();

process.on("uncaughtException", (error) => {
  console.error(chalk.red(error));
});
