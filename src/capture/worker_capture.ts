import { parentPort, workerData } from 'worker_threads';
import { promisify } from 'util';
import { cv } from 'opencv-wasm';
import { run, stop } from './recorder';
import { CaptureMode, RecorderContext } from './defs';
import { capture } from './capture';

const pause = promisify(setTimeout);

// TODO: Blob化？
// const { Blob } = require('buffer');

const { DoubleBuffer } = require('../utils/shared_double_buffer');
const doubleBuffer = new DoubleBuffer(workerData.width * workerData.height * 3 + 54, workerData.doubleBufferShared);

const DEBUG = true;

console.log('capture worker');

let _mode: CaptureMode = 'stream';

async function captureLoop(context: RecorderContext, sec = 180, limit = 20) {
  for (let i = 0; i < limit; i++) {
    console.log('recording session:', _mode, context.session);
    let captureCount: number = 0;

    if (_mode == 'stream') {
      context.mode = _mode;
      captureCount = await run(context, workerData.width, workerData.height, sec);
    } else if (_mode == 'snapshot') {
      context.mode = _mode;
      const img = await capture();
      img.resize(workerData.width, workerData.height);

      // RGBA => BGR
      const src = cv.matFromArray(workerData.height, workerData.width, cv.CV_8UC4, img.bitmap.data);
      const dst = new cv.Mat();
      const mvSrc = new cv.MatVector();
      const mvDst = new cv.MatVector();
      const output = new Uint8Array(workerData.width * workerData.height * 3 + 54);
      cv.split(src, mvSrc);
      mvDst.push_back(mvSrc.get(2)); // B
      mvDst.push_back(mvSrc.get(1)); // G
      mvDst.push_back(mvSrc.get(0)); // R
      cv.merge(mvDst, dst);
      output.set(dst.data, 54); // header分をoffsetとしてずらす
      src.delete();
      dst.delete();
      mvSrc.delete();
      mvDst.delete();

      // push
      context.idx++;
      context.chunks = [output];
      captureCount = 1;

      // console.log('wait...');
      await pause(10 * 1000);
    }

    if (captureCount <= 0) break;

    context.session++;
  }
}

if (parentPort) {
  parentPort.on('message', (msg) => {
    if (!msg) stop();

    const { type, data } = msg;
    if (type == 'mode') {
      const { mode } = data;
      console.log(_mode, '=>', mode);
      _mode = mode;
    }
  });
}

(async () => {
  console.log('run recording');
  let cicleTimes = [];

  // キャプチャが終了したらfalse
  let loop = true;
  const context: RecorderContext = {
    mode: 'stream',
    chunks: [],
    session: 0,
    idx: 0,
  };

  // キャプチャループ, 60sec x 180 == 3hours
  captureLoop(context, 60, 180)
    .catch((err) => console.log(err))
    .then(() => {
      console.log('captureLoop done');
      loop = false;
    });

  let hrprev = process.hrtime();

  try {
    // 送信ループ
    let idx = null;
    let session = null;
    while (loop) {
      // 処理済みのidxが設定されている場合待つ
      if (idx == context.idx && session == context.session) {
        // await pause(Math.floor(1000/90/2));
        await pause(1);
        continue;
      }

      // データが満ちていない場合待つ
      if (!context.chunks) {
        await pause(1);
        // await pause(Math.floor(1000/90/2));
        continue;
      }

      // 処理用のクローンを作成
      const target: RecorderContext = Object.assign({}, context);

      // 送信準備済みなのでクリア
      context.chunks = null;

      // shared array bufferに書き込み
      await doubleBuffer.put(target.idx, target.chunks);
      // console.log('push', target.idx);

      // 処理済みとしてマーク
      idx = target.idx;
      session = target.session;

      if (DEBUG) {
        const hrend = process.hrtime(hrprev);
        cicleTimes.push(hrend);
        hrprev = process.hrtime();
        if (!(cicleTimes.length % 100)) {
          const avg = cicleTimes.reduce((total, t) => (total += t[1]), 0) / 100;
          console.log(`capture cicle time avg: ${avg / 1000000} ms`);
          cicleTimes = [];
        }
      }

      // thread release
      await pause(1);
    }
  } catch (err) {
    console.log(err);
  }
})();
