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

  inSim.on(PacketType.ISP_SMALL, (packet) => {
    if (
      packet.SubT === SmallType.SMALL_VTA &&
      (packet.UVal === VoteAction.VOTE_RESTART ||
        packet.UVal === VoteAction.VOTE_QUALIFY)
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

      log.debug("Grid reordered with track AIs first");

      const trackIds = [track1Id, track2Id, track3Id];
      const otherPlayers = Array.from(players.values()).filter(
        (player) => !trackIds.includes(player.PLID),
      );

      const PLID = [...trackIds, ...otherPlayers.map((player) => player.PLID)];

      inSim.send(
        new IS_REO({
          PLID,
          NumP: PLID.length,
        }),
      );
    }
  });
}
