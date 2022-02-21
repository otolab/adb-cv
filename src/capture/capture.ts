import { execSync } from 'child_process';

const exec = (c: string) => execSync(c, { maxBuffer: 1024 * 1024 * 1024 });

const Jimp = require('jimp');
const ADB_PATH = process.env.ADB_PATH || 'adb';

export async function capture() {
  const buffer = exec(`${ADB_PATH} exec-out screencap -p`);
  const img = await Jimp.read(buffer);
  return img;
}
