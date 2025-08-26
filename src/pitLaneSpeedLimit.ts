import type { InSim } from "node-insim";
import {
  ObjectIndex,
  PacketType,
  PenaltyValue,
  UCOAction,
} from "node-insim/packets";

import { convertLfsSpeedToKmh } from "./lfsUnits";
import { createLog } from "./log";
import type { PlayerTrackingAPI } from "./playerTracking";

export function handlePitLaneSpeedLimit(
  inSim: InSim,
  speedLimitKmh: number,
  { players }: PlayerTrackingAPI,
) {
  const log = createLog(inSim);
  const playersInPitLane = new Set<number>();

  inSim.on(PacketType.ISP_UCO, (packet) => {
    // Pit start points
    const PIT_START_POINT_CIRCLE = 1;
    if (
      packet.UCOAction === UCOAction.UCO_CIRCLE_ENTER &&
      packet.Info.Index === ObjectIndex.MARSH_IS_AREA &&
      packet.Info.Heading === PIT_START_POINT_CIRCLE
    ) {
      playersInPitLane.add(packet.PLID);

      const player = players.get(packet.PLID);

      if (player) {
        log.message(`${player.PName}^8 entered the pit lane`);
      }
    }

    // Pit lane start / end
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
        const player = players.get(packet.PLID);

        if (player) {
          log.message(`${player.PName}^8 entered the pit lane`);
        }

        playersInPitLane.add(packet.PLID);
      }

      if (
        (isCheckpoint2 && hasCrossedInForwardDirection) ||
        (isCheckpoint1 && hasCrossedInReverseDirection)
      ) {
        const player = players.get(packet.PLID);

        if (player) {
          log.message(`${player.PName}^8 left the pit lane`);
        }

        playersInPitLane.delete(packet.PLID);
      }
    }
  });

  inSim.on(PacketType.ISP_MCI, (packet) => {
    packet.Info.forEach((compCar) => {
      if (!playersInPitLane.has(compCar.PLID)) {
        return;
      }

      const player = players.get(compCar.PLID);
      if (!player) {
        log.error(`Player with ${compCar.PLID} not found`);
        return;
      }

      const speedInKmh = convertLfsSpeedToKmh(compCar.Speed);
      const OVERSPEED = 20;

      if (speedInKmh > speedLimitKmh + OVERSPEED) {
        if (
          player.penalty !== PenaltyValue.PENALTY_NONE &&
          player.penalty !== PenaltyValue.PENALTY_DT_VALID
        ) {
          return;
        }

        log.message(
          `${player.PName}^8 is speeding more than ${OVERSPEED} over the speed limit of ${speedLimitKmh} km/h in pit lane`,
        );

        inSim.sendMessage(`/p_sg ${player.PName}`);
        return;
      }

      if (speedInKmh > speedLimitKmh) {
        if (player.penalty !== PenaltyValue.PENALTY_NONE) {
          return;
        }

        log.message(
          `${player.PName}^8 is going more than ${speedLimitKmh} km/h in pit lane`,
        );

        inSim.sendMessage(`/p_dt ${player.PName}`);
        return;
      }
    });
  });

  inSim.on(PacketType.ISP_PLP, (packet) => {
    playersInPitLane.delete(packet.PLID);

    const player = players.get(packet.PLID);

    if (player) {
      log.message(`${player.PName}^8 left the pit lane`);
    }
  });

  inSim.on(PacketType.ISP_PLL, (packet) => {
    playersInPitLane.delete(packet.PLID);

    log.message(`PLID ${packet.PLID}^8 left the pit lane`);
  });
}
