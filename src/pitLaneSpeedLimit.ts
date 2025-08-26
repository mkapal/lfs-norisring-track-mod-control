import { convertLfsSpeedToMetersPerSecond } from "./lfsUnits";
import type { InSim } from "./libs/node-insim";
import { ObjectIndex, PacketType, UCOAction } from "./libs/node-insim/packets";
import { createLog } from "./log";

export function handlePitLaneSpeedLimit(inSim: InSim, speedLimitKph: number) {
  const log = createLog(inSim);
  const playersInPitLane = new Set<number>();

  inSim.on(PacketType.ISP_UCO, (packet) => {
    if (packet.Info.Index === ObjectIndex.MARSH_IS_CP) {
      const isCheckpoint1 =
        (packet.Info.Flags & 1) !== 0 && (packet.Info.Flags & 2) === 0;
      const isCheckpoint2 =
        (packet.Info.Flags & 1) === 0 && (packet.Info.Flags & 2) !== 0;
      const hasCrossedInForwardDirection =
        packet.UCOAction === UCOAction.UCO_CP_FWD;
      const hasCrossedInReverseDirection =
        packet.UCOAction === UCOAction.UCO_CP_REV;

      if (
        (isCheckpoint1 && hasCrossedInForwardDirection) ||
        (isCheckpoint2 && hasCrossedInReverseDirection)
      ) {
        inSim.sendMessageToPlayer(packet.PLID, "Entered the pit lane");
        playersInPitLane.add(packet.PLID);
      }

      if (
        (isCheckpoint2 && hasCrossedInForwardDirection) ||
        (isCheckpoint1 && hasCrossedInReverseDirection)
      ) {
        inSim.sendMessageToPlayer(packet.PLID, "Left the pit lane");
        playersInPitLane.delete(packet.PLID);
      }
    }
  });

  inSim.on(PacketType.ISP_MCI, (packet) => {
    packet.Info.forEach((compCar) => {
      if (
        playersInPitLane.has(compCar.PLID) &&
        convertLfsSpeedToMetersPerSecond(compCar.Speed) > speedLimitKph / 3.6
      ) {
        log.log("A player is speeding!");
        // inSim.sendMessageToPlayer(compCar.PLID, `You are speeding!`);
        // TODO keep track of players
      }
    });
  });
}
