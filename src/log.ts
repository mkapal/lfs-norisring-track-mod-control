import chalk from "chalk";

import type { InSim } from "./libs/node-insim";
import { MessageSound } from "./libs/node-insim/packets";

export function createLog(inSim: InSim) {
  return {
    log: (message: string) => {
      console.log(message);
      inSim.sendLocalMessage(message, MessageSound.SND_SYSMESSAGE);
    },
    success: (message: string) => {
      console.info(chalk.green(message));
      inSim.sendLocalMessage(`^2${message}`, MessageSound.SND_ERROR);
    },
    error: (message: string) => {
      console.error(chalk.red(message));
    },
  };
}
