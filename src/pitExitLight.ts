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
  const END_CHECKPOINT = { X: -11153, Y: -5998, Z: 8 };
  const START_CHECKPOINT = { X: -11811, Y: -9101, Z: 8 };
  const PIT_EXIT_START_LIGHT = 10;

  inSim.on(PacketType.ISP_UCO, (packet) => {
    if (packet.Info.Index !== ObjectIndex.MARSH_IS_CP) {
      return;
    }

    const isCheckpoint3 =
      (packet.Info.Flags & 1) !== 0 && (packet.Info.Flags & 2) !== 0;

    const isStartCheckpoint =
      isCheckpoint3 &&
      packet.Info.X === START_CHECKPOINT.X &&
      packet.Info.Y === START_CHECKPOINT.Y &&
      packet.Info.Zbyte === START_CHECKPOINT.Z;
    const isEndCheckpoint =
      isCheckpoint3 &&
      packet.Info.X === END_CHECKPOINT.X &&
      packet.Info.Y === END_CHECKPOINT.Y &&
      packet.Info.Zbyte === END_CHECKPOINT.Z;

    if (isStartCheckpoint) {
      if (packet.UCOAction === UCOAction.UCO_CP_FWD) {
        setGreen();
      } else if (packet.UCOAction === UCOAction.UCO_CP_REV) {
        setRed();
      }
    }

    if (isEndCheckpoint) {
      if (packet.UCOAction === UCOAction.UCO_CP_FWD) {
        setRed();
      } else if (packet.UCOAction === UCOAction.UCO_CP_REV) {
        setGreen();
      }
    }
  });

  inSim.on(PacketType.ISP_PLP, () => {
    setGreen();
  });

  inSim.on(PacketType.ISP_PLL, () => {
    setGreen();
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
