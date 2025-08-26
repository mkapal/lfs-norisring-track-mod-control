import type { InSim } from "./libs/node-insim";
import {
  IS_ISI_ReqI,
  IS_TINY,
  PacketType,
  PlayerType,
  TinyType,
} from "./libs/node-insim/packets";
import { createLog } from "./log";

const aiPLIDs: {
  N77_TRACK_2: number | null;
  N77_TRACK: number | null;
} = {
  N77_TRACK_2: null,
  N77_TRACK: null,
};

export function handleAiTrackIds(
  inSim: InSim,
  config: { track1name: string; track2name: string },
) {
  const log = createLog(inSim);

  inSim.on(PacketType.ISP_VER, (packet) => {
    if (packet.ReqI !== IS_ISI_ReqI.SEND_VERSION) {
      return;
    }

    inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NPL }));
  });

  inSim.on(PacketType.ISP_ISM, (packet) => {
    if (packet.ReqI > 0) {
      return;
    }

    clear();
    inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NPL }));
  });

  inSim.on(PacketType.ISP_TINY, (packet) => {
    if (packet.SubT === TinyType.TINY_CLR) {
      clear();
    }
  });

  inSim.on(PacketType.ISP_NPL, (packet) => {
    if (packet.PType & PlayerType.AI && packet.PName === config.track1name) {
      log.success(`Found N77 TRACK: ${config.track1name}`);
      aiPLIDs.N77_TRACK = packet.PLID;
    }

    if (packet.PType & PlayerType.AI && packet.PName === config.track2name) {
      log.success(`Found N77 TRACK 2: ${config.track2name}`);
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

  function clear() {
    aiPLIDs.N77_TRACK_2 = null;
    aiPLIDs.N77_TRACK = null;
  }

  return {
    getTrack1: () => {
      return aiPLIDs.N77_TRACK;
    },
    getTrack2: () => {
      return aiPLIDs.N77_TRACK_2;
    },
  };
}
