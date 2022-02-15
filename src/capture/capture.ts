import { execSync } from 'child_process';

const exec = (c: string) => execSync(c, { maxBuffer: 1024 * 1024 * 1024 });

const Jimp = require('jimp');
const CMD_PATH = '/Users/naotokato/Develop/tools/platform-tools/adb';

export async function capture() {
  const buffer = exec(`${CMD_PATH} exec-out screencap -p`);
  const img = await Jimp.read(buffer);
  return img;
}
