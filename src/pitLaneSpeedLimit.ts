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
  let pitSpeedMessageTimeout: NodeJS.Timeout | null = null;

  inSim.on(PacketType.ISP_UCO, (packet) => {
    const player = players.get(packet.PLID);

    if (!player) {
      log.error(
        `Player with ${packet.PLID} not found when crossing an InSim checkpoint or circle`,
      );
      return;
    }

    // Pit start points
    const PIT_START_POINT_CIRCLE = 1;
    if (
      packet.UCOAction === UCOAction.UCO_CIRCLE_ENTER &&
      packet.Info.Index === ObjectIndex.MARSH_IS_AREA &&
      packet.Info.Heading === PIT_START_POINT_CIRCLE
    ) {
      playersInPitLane.add(packet.PLID);

      inSim.sendMessage(`/rcm Pit speed limit: ^3${speedLimitKmh}^8 km/h`);
      inSim.sendMessage(`/rcm_ply ${player.PName}`);

      pitSpeedMessageTimeout = setTimeout(() => {
        inSim.sendMessage(`/rcc_ply ${player.PName}`);
      }, 5000);

      log.debug(`${player.PName}^8 entered the pit lane from pits`);
      return;
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
        playersInPitLane.add(packet.PLID);

        if (
          player.penalty === PenaltyValue.PENALTY_DT_VALID ||
          player.penalty === PenaltyValue.PENALTY_DT
        ) {
          log.debug(
            `${player.PName}^8 entered the pit lane for drive-through penalty`,
          );
        }

        if (
          player.penalty === PenaltyValue.PENALTY_SG_VALID ||
          player.penalty === PenaltyValue.PENALTY_SG
        ) {
          log.debug(
            `${player.PName}^8 entered the pit lane for stop-go penalty`,
          );
        }

        return;
      }

      if (
        (isCheckpoint2 && hasCrossedInForwardDirection) ||
        (isCheckpoint1 && hasCrossedInReverseDirection)
      ) {
        log.debug(`${player.PName}^8 left the pit lane`);

        playersInPitLane.delete(packet.PLID);

        // Clear penalty if player has left the pit lane with a valid penalty
        if (
          player.penalty === PenaltyValue.PENALTY_DT_VALID ||
          player.penalty === PenaltyValue.PENALTY_SG_VALID
        ) {
          log.debug(
            `${player.PName} has left the pit lane with a valid penalty - penalty cleared`,
          );
          inSim.sendMessage(`/p_clear ${player.PName}`);
          return;
        }

        // Make penalty valid if player has left the pit lane with a penalty
        if (player.penalty === PenaltyValue.PENALTY_DT) {
          player.penalty = PenaltyValue.PENALTY_DT_VALID;
          log.debug(
            `${player.PName} has left the pit lane with a drive-through penalty`,
          );
          return;
        }

        if (player.penalty === PenaltyValue.PENALTY_SG) {
          player.penalty = PenaltyValue.PENALTY_SG_VALID;
          log.debug(
            `${player.PName} has left the pit lane with a stop-go penalty`,
          );
          return;
        }

        return;
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
        // Invalidate existing speeding penalties
        if (player.penalty === PenaltyValue.PENALTY_DT_VALID) {
          player.penalty = PenaltyValue.PENALTY_DT;
          inSim.sendMessage(`/p_dt ${player.PName}`);
        }

        if (player.penalty === PenaltyValue.PENALTY_SG_VALID) {
          player.penalty = PenaltyValue.PENALTY_SG;
          inSim.sendMessage(`/p_sg ${player.PName}`);
        }

        if (player.penalty === PenaltyValue.PENALTY_DT) {
          player.penalty = PenaltyValue.PENALTY_SG;
          inSim.sendMessage(`/p_sg ${player.PName}`);
          log.debug(
            `${player.PName}^8 is speeding more than ${OVERSPEED} over the limit of ${speedLimitKmh} km/h in pit lane`,
          );
        }

        return;
      }

      if (speedInKmh > speedLimitKmh) {
        const speedingMessage = `${player.PName}^8 is going more than ${speedLimitKmh} km/h in pit lane`;

        // Drive-through penalty for speeding
        if (player.penalty === PenaltyValue.PENALTY_NONE) {
          player.penalty = PenaltyValue.PENALTY_DT;
          inSim.sendMessage(`/p_dt ${player.PName}`);
          log.debug(speedingMessage);
        }

        // Invalidate existing speeding penalties
        if (player.penalty === PenaltyValue.PENALTY_DT_VALID) {
          player.penalty = PenaltyValue.PENALTY_DT;
          inSim.sendMessage(`/p_dt ${player.PName}`);

          log.debug(speedingMessage);
          log.debug(
            `${player.PName} - invalidate existing drive-through penalty`,
          );
        }

        if (player.penalty === PenaltyValue.PENALTY_SG_VALID) {
          player.penalty = PenaltyValue.PENALTY_SG;
          inSim.sendMessage(`/p_sg ${player.PName}`);

          log.debug(speedingMessage);
          log.debug(`${player.PName} - invalidate existing stop-go penalty`);
        }

        return;
      }
    });
  });

  inSim.on(PacketType.ISP_PLP, (packet) => {
    if (pitSpeedMessageTimeout) {
      clearTimeout(pitSpeedMessageTimeout);
    }

    if (!playersInPitLane.has(packet.PLID)) {
      return;
    }

    playersInPitLane.delete(packet.PLID);

    const player = players.get(packet.PLID);

    if (player) {
      log.debug(`${player.PName}^8 left the pit lane`);
    }
  });

  inSim.on(PacketType.ISP_PLL, (packet) => {
    if (pitSpeedMessageTimeout) {
      clearTimeout(pitSpeedMessageTimeout);
    }

    if (!playersInPitLane.has(packet.PLID)) {
      return;
    }

    playersInPitLane.delete(packet.PLID);

    log.debug(`PLID ${packet.PLID}^8 left the pit lane`);
  });

  inSim.on(PacketType.ISP_PEN, (packet) => {
    const player = players.get(packet.PLID);

    if (!player) {
      log.error(
        `Failed to update player penalty - PLID not found: ${packet.PLID}`,
      );
      return;
    }

    if (playersInPitLane.has(packet.PLID)) {
      if (packet.NewPen === PenaltyValue.PENALTY_DT_VALID) {
        player.penalty = PenaltyValue.PENALTY_DT;
        log.debug(
          `${player.PName} got a drive-through penalty while in pit lane`,
        );
      }

      if (packet.NewPen === PenaltyValue.PENALTY_SG_VALID) {
        player.penalty = PenaltyValue.PENALTY_SG;
        log.debug(`${player.PName} got a stop-go penalty while in pit lane`);
      }
    } else {
      player.penalty = packet.NewPen;
    }

    player.penaltyReason = packet.Reason;
  });
}
