import chalk from "chalk";
import type { InSim } from "node-insim";
import { MessageSound } from "node-insim/packets";

export function createLog(inSim: InSim) {
  return {
    debug: (message: string) => {
      console.debug(message);
    },
    message: (message: string) => {
      console.log(message);
      inSim.sendLocalMessage(message, MessageSound.SND_SILENT);
    },
    success: (message: string) => {
      console.info(chalk.green(message));
      inSim.sendLocalMessage(`^2${message}`, MessageSound.SND_SYSMESSAGE);
    },
    error: (message: string) => {
      console.error(chalk.red(message));
      inSim.sendLocalMessage(`^1${message}`, MessageSound.SND_ERROR);
    },
  };
}
