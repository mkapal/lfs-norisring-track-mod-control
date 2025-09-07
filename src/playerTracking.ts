import { type InSim } from "node-insim";
import { type IS_NCN, type IS_NPL } from "node-insim/packets";
import {
  IS_ISI_ReqI,
  IS_TINY,
  PacketType,
  PenaltyReason,
  PenaltyValue,
  PlayerType,
  TinyType,
} from "node-insim/packets";

import { createLog } from "./log";

export type Connection = Pick<
  IS_NCN,
  "UCID" | "UName" | "PName" | "Admin" | "Flags"
> & {
  players: Player[];
};

export type Player = Pick<
  IS_NPL,
  "UCID" | "PLID" | "PName" | "Flags" | "PType" | "Plate"
> & {
  rawName: string;
  connection: Connection | null;
  penalty: PenaltyValue;
  penaltyReason: PenaltyReason;
  lapsDone: number;
};

const players = new Map<number, Player>();

const connections = new Map<number, Connection>();

export type PlayerTrackingAPI = {
  players: Map<number, Player>;
  connections: Map<number, Connection>;
};

export function playerTracking(inSim: InSim): PlayerTrackingAPI {
  const log = createLog(inSim);

  inSim.on(PacketType.ISP_VER, (packet) => {
    if (packet.ReqI === IS_ISI_ReqI.SEND_VERSION) {
      log.debug("Requesting all players and connections");
      inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NCN }));
      inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NPL }));
    }
  });

  inSim.on(PacketType.ISP_ISM, (packet, inSim) => {
    if (packet.ReqI > 0) {
      return;
    }

    connections.clear();
    inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NCN }));

    players.clear();
    inSim.send(new IS_TINY({ ReqI: 1, SubT: TinyType.TINY_NPL }));

    log.debug("Cleared players and connections");
  });

  inSim.on(PacketType.ISP_TINY, (packet) => {
    if (packet.SubT === TinyType.TINY_CLR) {
      players.clear();

      connections.forEach((connection) => {
        connection.players = [];
      });

      log.debug("Cleared players");
    }
  });

  inSim.on(PacketType.ISP_NCN, (packet) => {
    connections.set(packet.UCID, {
      UCID: packet.UCID,
      UName: packet.UName,
      PName: packet.PName,
      Admin: packet.Admin,
      Flags: packet.Flags,
      players: [],
    });

    log.debug(`New connection: ${packet.UName} (UCID ${packet.UCID})`);
  });

  inSim.on(PacketType.ISP_CNL, (packet) => {
    const connection = connections.get(packet.UCID);

    if (!connection) {
      log.error(`Failed to delete connection - UCID not found: ${packet.UCID}`);
      return;
    }

    connections.delete(packet.UCID);

    log.debug(`Connection left: ${connection.UName} (UCID ${packet.UCID})`);
  });

  inSim.on(PacketType.ISP_CPR, (packet) => {
    const connection = connections.get(packet.UCID);

    if (!connection) {
      log.error(
        `Failed to rename connection players - UCID not found: ${packet.UCID}`,
      );

      return;
    }

    const humanPlayer = connection.players.find(
      ({ PType }) => (PType & PlayerType.AI) === 0,
    );

    const connectionPlayers = connection.players.map<Player>((player) => {
      if ((player.PType & PlayerType.AI) === 0) {
        return {
          ...player,
          PName: packet.PName,
        };
      }

      return player;
    });

    connections.set(packet.UCID, {
      ...connection,
      PName: packet.PName,
      ...(humanPlayer ? { players: connectionPlayers } : {}),
    });

    const matchingPlayer = Array.from(players.values()).find(
      (player) =>
        player.UCID === packet.UCID && (player.PType & PlayerType.AI) === 0,
    );

    if (!matchingPlayer) {
      log.error(
        `Failed to rename player - human player not found for UCID ${packet.UCID}`,
      );
      return;
    }

    players.set(matchingPlayer.PLID, {
      ...matchingPlayer,
      PName: packet.PName,
      Plate: packet.Plate,
    });
    log.debug(
      `Player renamed: ${packet.PName} (UCID ${packet.UCID}, PLID ${matchingPlayer.PLID})`,
    );
  });

  inSim.on(PacketType.ISP_NPL, (packet) => {
    const connection = connections.get(packet.UCID);

    players.set(packet.PLID, {
      UCID: packet.UCID,
      PLID: packet.PLID,
      PName: packet.PName,
      rawName: packet._raw.PName,
      Flags: packet.Flags,
      PType: packet.PType,
      Plate: packet.Plate,
      connection: connection ?? null,
      penalty: PenaltyValue.PENALTY_NONE,
      penaltyReason: PenaltyReason.PENR_UNKNOWN,
      lapsDone: 0,
    });

    log.debug(
      `New player: ${packet.PName} (UCID ${packet.UCID}, PLID ${packet.PLID})`,
    );
  });

  inSim.on(PacketType.ISP_PLL, (packet) => {
    const player = players.get(packet.PLID);

    if (!player) {
      log.error(`Failed to delete player - PLID not found: ${packet.PLID}`);
      return;
    }

    players.delete(packet.PLID);

    log.debug(`Player left: ${player.PName} (PLID ${packet.PLID})`);
  });

  inSim.on(PacketType.ISP_TOC, (packet) => {
    const foundPlayer = players.get(packet.PLID);
    if (!foundPlayer) {
      log.error(
        `Failed to update player after takeover - PLID not found: ${packet.PLID}`,
      );
      return;
    }

    const connection = connections.get(packet.NewUCID);
    if (!connection) {
      log.error(
        `Failed to update player's connection after takeover - UCID not found: ${packet.NewUCID}`,
      );

      return;
    }

    players.set(packet.PLID, {
      ...foundPlayer,
      UCID: packet.NewUCID,
      connection,
    });

    log.debug(
      `Player took over: ${foundPlayer.PName} (UCID ${packet.NewUCID}, PLID ${packet.PLID})`,
    );
  });

  inSim.on(PacketType.ISP_LAP, (packet) => {
    const foundPlayer = players.get(packet.PLID);
    if (!foundPlayer) {
      log.error(
        `Failed to update player after lap - PLID not found: ${packet.PLID}`,
      );

      return;
    }

    log.debug(`${foundPlayer.PName} has completed ${packet.LapsDone} lap(s)`);
    foundPlayer.lapsDone = packet.LapsDone;
  });

  return {
    players,
    connections,
  };
}
