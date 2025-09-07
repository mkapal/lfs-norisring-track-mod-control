import { type InSim } from "node-insim";
import { IS_ISI_ReqI, IS_TINY, PacketType, TinyType } from "node-insim/packets";

import { lfsLapsToLapsOrHours } from "./lfsUnits";
import { createLog } from "./log";

export type RaceState = {
  raceLaps: number | null;
  raceHours: number | null;
};

export function handleRaceState(inSim: InSim): RaceState {
  const log = createLog(inSim);

  const state: RaceState = {
    raceLaps: null,
    raceHours: null,
  };

  inSim.on(PacketType.ISP_VER, (packet) => {
    if (packet.ReqI !== IS_ISI_ReqI.SEND_VERSION) {
      return;
    }

    inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_SST }));
  });

  inSim.on(PacketType.ISP_STA, (packet) => {
    const lapsOrHours = lfsLapsToLapsOrHours(packet.RaceLaps);
    if (lapsOrHours?.unit === "laps") {
      if (state.raceLaps !== lapsOrHours.value) {
        state.raceLaps = lapsOrHours.value;
        state.raceHours = null;
        log.debug(`Updated race duration to ${lapsOrHours.value} laps`);
      }
    } else if (lapsOrHours?.unit === "hours") {
      if (state.raceHours !== lapsOrHours.value) {
        state.raceLaps = null;
        state.raceHours = lapsOrHours.value;
        log.debug(`Updated race duration to ${lapsOrHours.value} hours`);
      }
    }
  });

  return state;
}
