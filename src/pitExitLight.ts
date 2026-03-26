import { type InSim } from "node-insim";
import {
  IS_OCO,
  ObjectIndex,
  OCOAction,
  OCOAutocrossStartLights,
  PacketType,
  UCOAction,
} from "node-insim/packets";

export function handlePitExitLight(inSim: InSim) {
  const DETECTION_START_CIRCLE = 2;
  const DETECTION_END_CIRCLE = 3;
  const PIT_EXIT_START_LIGHT = 10;

  const playerIdsInZone = new Set<number>([]);

  inSim.on(PacketType.ISP_UCO, (packet) => {
    if (
      packet.UCOAction === UCOAction.UCO_CIRCLE_ENTER &&
      packet.Info.Index === ObjectIndex.MARSH_IS_AREA &&
      packet.Info.Heading === DETECTION_START_CIRCLE
    ) {
      playerIdsInZone.add(packet.PLID);
    }

    if (
      packet.UCOAction === UCOAction.UCO_CIRCLE_ENTER &&
      packet.Info.Index === ObjectIndex.MARSH_IS_AREA &&
      packet.Info.Heading === DETECTION_END_CIRCLE
    ) {
      playerIdsInZone.delete(packet.PLID);
    }

    if (playerIdsInZone.size === 0) {
      setGreen();
    } else {
      setRed();
    }
  });

  inSim.on(PacketType.ISP_PLL, (packet) => {
    playerIdsInZone.delete(packet.PLID);

    if (playerIdsInZone.size === 0) {
      setGreen();
    }
  });

  function setRed() {
    inSim.send(
      new IS_OCO({
        OCOAction: OCOAction.OCO_LIGHTS_SET,
        Identifier: PIT_EXIT_START_LIGHT,
        Index: ObjectIndex.AXO_START_LIGHTS1,
        Data: OCOAutocrossStartLights.RED,
      }),
    );
  }

  function setGreen() {
    inSim.send(
      new IS_OCO({
        OCOAction: OCOAction.OCO_LIGHTS_SET,
        Identifier: PIT_EXIT_START_LIGHT,
        Index: ObjectIndex.AXO_START_LIGHTS1,
        Data: OCOAutocrossStartLights.GREEN,
      }),
    );
  }
}
