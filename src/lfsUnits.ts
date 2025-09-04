export function convertLfsAngleToDegrees(value: number) {
  return (value / 32768) * 180;
}

export function convertDegreesToLfsAngle(value: number) {
  return (value / 180) * 32768;
}

export function convertLfsSpeedToMetersPerSecond(value: number) {
  return value / 327.68;
}

export function convertLfsSpeedToKmh(value: number) {
  return (value / 327.68) * 3.6;
}

export function convertMetersToLfsCarPositionUnits(value: number) {
  return value * 65536;
}

export function convertLfsCarPositionUnitsToMeters(value: number) {
  return value / 65536;
}

export function lfsLapsToLapsOrHours(raceLaps: number): {
  value: number;
  unit: "laps" | "hours";
} | null {
  if (raceLaps >= 0 && raceLaps <= 99) {
    return {
      value: raceLaps,
      unit: "laps",
    };
  }

  if (raceLaps >= 100 && raceLaps <= 190) {
    return {
      value: (raceLaps - 100) * 10 + 100,
      unit: "laps",
    };
  }

  if (raceLaps >= 191 && raceLaps <= 238) {
    return {
      value: raceLaps - 190,
      unit: "hours",
    };
  }

  return null;
}
