import { ChildProcessByStdio, spawn } from 'child_process';
import { RecorderContext } from './defs';

type CallbackFunction = (...args: any[]) => void;

const DEBUG = false;

const CMD_PATH = '/Users/naotokato/Develop/tools/platform-tools/adb';
const BMP_HEADER_SIZE = 54;

let _adbProc: ChildProcessByStdio<null, null, null> | null = null; // umm...

function createPipeLine(width: number, height: number, sec: number, cb: CallbackFunction) {
  const ffmpegProc = spawn('ffmpeg', [
    '-i',
    '-',
    '-vf',
    'vflip',
    '-pix_fmt',
    'bgr24',
    '-c:v',
    'bmp',
    '-f',
    'rawvideo',
    '-an',
    '-bufsize',
    '8388608',
    '-probesize',
    '32',
    '-framerate',
    '90',
    '-',
  ]);

  const adbProc = spawn(
    CMD_PATH,
    [
      'exec-out',
      'screenrecord',
      '--bit-rate',
      '4000000',
      '--time-limit',
      '' + sec,
      '--size',
      `${width}x${height}`,
      '--output-format=h264',
      '-',
    ],
    {
      stdio: ['ignore', ffmpegProc.stdin, 'ignore'],
    }
  );

  adbProc.on('exit', () => {
    console.log('screenrecord done, close pipe');
    ffmpegProc.stdin.end();
  });
  ffmpegProc.on('exit', cb);

  // fpsをチェックしたいときとか
  if (DEBUG) ffmpegProc.stderr.pipe(process.stdout);

  // umm...
  _adbProc = adbProc;

  return {
    stdout: ffmpegProc.stdout,
  };
}

export async function run(context: RecorderContext, width: number, height: number, sec: number): Promise<number> {
  return new Promise((resolve) => {
    let count = 0;
    // context.width = width;
    // context.height = height;

    const decoder = createPipeLine(width, height, sec, (...args) => {
      console.log(args);
      resolve(count);
    });

    let chunks: any[] = [];
    const frameSize = width * height * 3 + BMP_HEADER_SIZE;

    decoder.stdout
      .on('data', (data) => {
        const chunkSize = chunks.reduce((t, c) => t + c.length, 0);
        if (chunkSize + data.length >= frameSize) {
          const delta = frameSize - chunkSize;

          chunks.push(data.slice(0, delta));

          context.chunks = chunks;
          context.idx++;
          count++;

          chunks = [];
          if (delta > 0) {
            chunks.push(data.slice(delta));
          }
        } else {
          chunks.push(data);
        }
      })
      .on('end', () => {
        console.log('stream done');
      });
  });
}

export function stop() {
  if (!_adbProc) return false;
  return _adbProc.kill();
}
