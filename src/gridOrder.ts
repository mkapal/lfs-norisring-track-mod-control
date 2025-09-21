import { type InSim } from "node-insim";
import { IS_REO, PacketType, SmallType, VoteAction } from "node-insim/packets";

import { type AITrackIDsAPI } from "./aiTrackIds";
import { createLog } from "./log";
import { type PlayerTrackingAPI } from "./playerTracking";

export function gridOrder(
  inSim: InSim,
  { players }: PlayerTrackingAPI,
  aiTrackIDs: AITrackIDsAPI,
) {
  const log = createLog(inSim);

  let results: number[] = [];

  inSim.on(PacketType.ISP_SMALL, ({ SubT, UVal }) => {
    if (
      SubT === SmallType.SMALL_VTA &&
      (UVal === VoteAction.VOTE_RESTART || UVal === VoteAction.VOTE_QUALIFY)
    ) {
      log.debug("Voting to restart or qualify");

      const track1Id = aiTrackIDs.getTrack1();
      const track2Id = aiTrackIDs.getTrack2();
      const track3Id = aiTrackIDs.getTrack3();

      if (!track1Id) {
        log.error("Grid order: Track 1 PLID not found");

        return;
      }

      if (!track2Id) {
        log.error("Grid order: Track 2 PLID not found");

        return;
      }

      if (!track3Id) {
        log.error("Grid order: Track 3 PLID not found");

        return;
      }

      log.debug(`New grid order:`);

      const trackIds = [track1Id, track2Id, track3Id];

      trackIds.forEach((trackId) => {
        const player = players.get(trackId);

        if (player) {
          log.debug(`! - ${player.PName} (PLID ${trackId})`);
        }
      });

      results.forEach((result, index) => {
        const player = players.get(result);
        if (player) {
          log.debug(`${index} - ${player.PName} (PLID ${result})`);
        }
      });

      const otherPlayers = Array.from(players.values()).filter(
        (player) =>
          !trackIds.includes(player.PLID) && !results.includes(player.PLID),
      );
      const otherPlayerIds = otherPlayers.map((player) => player.PLID);

      otherPlayerIds.forEach((otherPlayerId) => {
        const player = players.get(otherPlayerId);

        if (player) {
          log.debug(`? - ${player.PName} (PLID ${otherPlayerId})`);
        }
      });

      const PLID = [...trackIds, ...results, ...otherPlayerIds];

      inSim.send(
        new IS_REO({
          PLID,
          NumP: PLID.length,
        }),
      );
    }
  });

  inSim.on(PacketType.ISP_RES, (packet) => {
    if (packet.ReqI !== 0 || packet.ResultNum === 255) {
      return;
    }

    const player = players.get(packet.PLID);

    log.debug(
      `Result ${packet.ResultNum}: PLID ${packet.PLID} (${player?.PName})`,
    );
    results[packet.ResultNum] = packet.PLID;
  });

  inSim.on(PacketType.ISP_RST, () => {
    results = [];
  });
}
