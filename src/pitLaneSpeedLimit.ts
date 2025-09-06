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
import type { RaceState } from "./raceState";

export function handlePitLaneSpeedLimit(
  inSim: InSim,
  speedLimitKmh: number,
  { players }: PlayerTrackingAPI,
  raceState: RaceState,
) {
  const log = createLog(inSim);
  const playersInPitLane = new Set<number>();
  let pitSpeedMessageTimeout: NodeJS.Timeout | null = null;

  inSim.on(PacketType.ISP_UCO, (packet) => {
    // Pit lane start / end
    if (packet.Info.Index === ObjectIndex.MARSH_IS_CP) {
      const player = players.get(packet.PLID);
      if (!player) {
        log.error(
          `Player with PLID ${packet.PLID} not found when crossing an InSim checkpoint`,
        );
        return;
      }

      const connection = player.connection;
      if (!connection) {
        log.error(
          `Connection for player ${player.PName}^8 not found when crossing an InSim checkpoint`,
        );
        return;
      }

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
          inSim.sendMessage(`/p_clear ${connection.UName}`);
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

    // Pit start points
    const PIT_START_POINT_CIRCLE = 1;
    if (
      packet.UCOAction === UCOAction.UCO_CIRCLE_ENTER &&
      packet.Info.Index === ObjectIndex.MARSH_IS_AREA &&
      packet.Info.Heading === PIT_START_POINT_CIRCLE
    ) {
      // Delay to allow the player to register in player tracker
      setTimeout(() => {
        const player = players.get(packet.PLID);
        if (!player) {
          log.error(
            `Player with PLID ${packet.PLID} not found when leaving pits`,
          );
          return;
        }

        const connection = player.connection;
        if (!connection) {
          log.error(
            `Connection for player ${player.PName}^8 not found when leaving pits`,
          );
          return;
        }

        playersInPitLane.add(packet.PLID);

        inSim.sendMessage(`/rcm Pit speed limit: ^3${speedLimitKmh}^8 km/h`);
        inSim.sendMessage(`/rcm_ply ${player.rawName}`);

        pitSpeedMessageTimeout = setTimeout(() => {
          log.debug(`${player.PName}^8 - cleared pit lane speed limit message`);
          inSim.sendMessage(`/rcc_ply ${player.rawName}`);
        }, 5000);

        log.debug(`${player.PName}^8 entered the pit lane from pits`);
      }, 500);
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

      const connection = player.connection;
      if (!connection) {
        log.error(`Connection for player ${player.PName}^8 not found`);
        return;
      }

      const speedInKmh = convertLfsSpeedToKmh(compCar.Speed);
      const OVERSPEED = 20;

      if (speedInKmh > speedLimitKmh + OVERSPEED) {
        const overSpeedingMessage = `${player.PName}^8 is speeding more than ${OVERSPEED} over the limit of ${speedLimitKmh} km/h in pit lane`;

        // Invalidate existing speeding penalties
        if (player.penalty === PenaltyValue.PENALTY_DT_VALID) {
          player.penalty = PenaltyValue.PENALTY_DT;
          inSim.sendMessage(`/p_dt ${connection.UName}`);

          return;
        }

        if (player.penalty === PenaltyValue.PENALTY_SG_VALID) {
          player.penalty = PenaltyValue.PENALTY_SG;
          inSim.sendMessage(`/p_sg ${connection.UName}`);

          return;
        }

        // Give stop-go penalty for speeding
        if (player.penalty === PenaltyValue.PENALTY_DT) {
          player.penalty = PenaltyValue.PENALTY_SG;
          inSim.sendMessage(`/p_sg ${connection.UName}`);
          log.debug(overSpeedingMessage);

          return;
        }

        // Give a time penalty if not enough laps remaining
        if (
          raceState.raceLaps !== null &&
          raceState.raceLaps > 0 &&
          raceState.raceLaps - player.lapsDone <= 2 &&
          player.penalty === PenaltyValue.PENALTY_30
        ) {
          player.penalty = PenaltyValue.PENALTY_45;
          inSim.sendMessage(`/p_45 ${connection.UName}`);
          log.debug(overSpeedingMessage);

          return;
        }

        return;
      }

      if (speedInKmh > speedLimitKmh) {
        const speedingMessage = `${player.PName}^8 is going more than ${speedLimitKmh} km/h in pit lane`;

        if (player.penalty === PenaltyValue.PENALTY_NONE) {
          log.debug(speedingMessage);

          // Give a time penalty if not enough laps remaining
          if (
            raceState.raceLaps !== null &&
            raceState.raceLaps > 0 &&
            raceState.raceLaps - player.lapsDone <= 2
          ) {
            player.penalty = PenaltyValue.PENALTY_30;
            inSim.sendMessage(`/p_30 ${connection.UName}`);
            return;
          }

          // Drive-through penalty for speeding
          player.penalty = PenaltyValue.PENALTY_DT;
          inSim.sendMessage(`/p_dt ${connection.UName}`);

          return;
        }

        // Invalidate existing speeding penalties
        if (player.penalty === PenaltyValue.PENALTY_DT_VALID) {
          player.penalty = PenaltyValue.PENALTY_DT;
          inSim.sendMessage(`/p_dt ${connection.UName}`);

          log.debug(speedingMessage);
          log.debug(
            `${player.PName} - invalidate existing drive-through penalty`,
          );

          return;
        }

        if (player.penalty === PenaltyValue.PENALTY_SG_VALID) {
          player.penalty = PenaltyValue.PENALTY_SG;
          inSim.sendMessage(`/p_sg ${connection.UName}`);

          log.debug(speedingMessage);
          log.debug(`${player.PName} - invalidate existing stop-go penalty`);

          return;
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

    player.penaltyReason = packet.Reason;
    player.penalty = packet.NewPen;

    if (playersInPitLane.has(packet.PLID)) {
      if (packet.NewPen === PenaltyValue.PENALTY_30) {
        log.debug(
          `${player.PName} got a 30 second time penalty for speeding in the pit lane`,
        );

        return;
      }

      if (packet.NewPen === PenaltyValue.PENALTY_45) {
        log.debug(
          `${player.PName} got a 45 second time penalty for speeding in the pit lane`,
        );

        return;
      }

      if (packet.NewPen === PenaltyValue.PENALTY_DT_VALID) {
        player.penalty = PenaltyValue.PENALTY_DT;
        log.debug(
          `${player.PName} got a drive-through penalty for speeding in the pit lane`,
        );

        return;
      }

      if (packet.NewPen === PenaltyValue.PENALTY_SG_VALID) {
        player.penalty = PenaltyValue.PENALTY_SG;
        log.debug(
          `${player.PName} got a stop-go penalty for speeding in pit lane`,
        );

        return;
      }
    }
  });
}
