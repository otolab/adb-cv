import { Worker } from 'worker_threads';
import { promisify } from 'util';
import { DoubleBuffer } from './utils/shared_double_buffer';
import { CaptureMode } from './capture/defs';
import { WorkerData as AnalyzerWorkerData, AnalyzeResultMessage, AnalyzeWorkerMessage } from './analyze/worker_analyze';
import { TemplateSetting, AreaSetting } from './plugins/template-match/template';
// import { worker } from 'cluster';

const pause = promisify(setTimeout);
function* range(n: number, i = 0) {
  while (i < n) yield i++;
}

const DEBUG = true;

interface AnalyzerWorkerObject {
  idx: number;
  buf: Buffer | ArrayBuffer;
  worker: Worker;
  fetchFrame: Function;
}

type ResultHandler = (results: AnalyzeResultMessage['results']) => void;

const _emptyAnalyzers: AnalyzerWorkerObject[] = [];

function createAnalyzeWorker(
  doubleBuffer: DoubleBuffer,
  idx: number,
  width: number,
  height: number,
  scale: number,
  areaSettings: { [key: string]: AreaSetting },
  templateSettings: TemplateSetting[],
  resultsHandler: ResultHandler
): AnalyzerWorkerObject {
  const buf = new SharedArrayBuffer(width * height * 3 + 54);
  const fetch = doubleBuffer.generateIter(buf, Math.floor(1000 / 60 / 2));

  const workerDataObject: AnalyzerWorkerData = {
    buf,
    commonConfig: {
      scale,
    },
    pluginSettings: {
      'template-match': {
        areaSettings,
        templateSettings,
      },
    },
  };

  let worker;
  try {
    worker = new Worker(`${__dirname}/analyze/worker_analyze.js`, {
      workerData: workerDataObject,
    });
  } catch (err) {
    console.log(err);
    process.exit(1);
  }

  const analyzer: AnalyzerWorkerObject = {
    idx,
    buf,
    worker,
    fetchFrame: async () => {
      const b = await fetch.next();
      if (!b.value) return null;
      return b.value;
    },
  };

  console.log(`worker(main): setup analyze worker ${idx}`);
  worker.on('exit', () => {
    console.log(`analyzeWorker ${idx} done`);
  });

  worker.on('message', (msg: AnalyzeResultMessage) => {
    if (msg.type == 'ready') {
      _emptyAnalyzers.push(analyzer);
    }
    if (msg.type == 'results') {
      // console.log('msg', msg);
      const { results } = msg;
      resultsHandler(results);

      _emptyAnalyzers.push(analyzer);
    }
  });

  return analyzer;
}

function createCaptureWorker(doubleBuffer: DoubleBuffer, width: number, height: number, cb: Function) {
  const captureWorker = new Worker(`${__dirname}/capture/worker_capture.js`, {
    workerData: {
      doubleBufferShared: doubleBuffer.shared,
      width,
      height,
    },
  });

  captureWorker.on('exit', () => {
    console.log('captureWorker done');
    cb();
  });

  return captureWorker;
}

export class Watcher {
  width: number;
  height: number;
  scale: number;
  doubleBuffer: DoubleBuffer;

  recorder: any;
  currentMode: CaptureMode = 'stream';

  constructor(width: number, height: number, scale: number = 1) {
    this.width = width;
    this.height = height;
    this.scale = scale;
    this.doubleBuffer = new DoubleBuffer(width * height * 3 + 54);
  }

  enableTemplates: string[] = [];

  resultsHandler: ResultHandler | null = null;

  loop: boolean = false;

  areaSettings: { [key: string]: AreaSetting } = [];

  templateSettings: TemplateSetting[] = [];

  setAreaSettings(areaSettings: { [key: string]: AreaSetting }) {
    this.areaSettings = areaSettings;
  }

  setTemplateSettings(templateSettings: TemplateSetting[]) {
    this.templateSettings = templateSettings;
  }

  setEnableTemplates(templates: string[]) {
    this.enableTemplates = templates;
  }

  setResultsHandler(handler: ResultHandler) {
    this.resultsHandler = handler;
  }

  setCaptureMode(mode: CaptureMode) {
    if (this.currentMode == mode) return;
    this.currentMode = mode;
    this.recorder.postMessage({
      type: 'mode',
      data: {
        mode,
      },
    });
  }

  startAnalyzeWorkers(): AnalyzerWorkerObject[] {
    let hrprev = process.hrtime();
    let cicleTimes: [number, number][] = [];

    const analyzers = Array.from(range(1), (i) =>
      createAnalyzeWorker(
        this.doubleBuffer,
        i,
        this.width,
        this.height,
        this.scale,
        this.areaSettings,
        this.templateSettings,
        (results: AnalyzeResultMessage['results']) => {
          if (DEBUG) {
            const hrend: [number, number] = process.hrtime(hrprev);
            cicleTimes.push(hrend);
            hrprev = process.hrtime();
            if (!(cicleTimes.length % 100)) {
              const avg = cicleTimes.reduce((total, t) => (total += t[1]), 0) / 100;
              console.log(`analyzer cycle time avg: ${avg / 1000000} ms`);
              cicleTimes = [];
            }
          }

          // console.log(`worker(main): recieve analyzed(${i})`, idx, results.map((r) => r.isMatch));
          if (this.resultsHandler) {
            this.resultsHandler(results);
          }
        }
      )
    );

    return analyzers;
  }

  startCaptureWorker(analyzers: AnalyzerWorkerObject[]): Worker {
    const recorder = createCaptureWorker(this.doubleBuffer, this.width, this.height, () => {
      this.loop = false;
      // FIXME: captureのスタートを連絡する
      analyzers.forEach(({ worker }) => {
        worker.postMessage(null);
      });
    });
    this.recorder = recorder; // fixme

    return recorder;
  }

  async mainLoop() {
    const emptyAnalyzer = _emptyAnalyzers.pop();

    if (!emptyAnalyzer) {
      this.doubleBuffer.truncate(); // analyzeのworkerが出払っているときでもcaptureを続ける
      await pause(Math.floor(1000 / 90 / 2));
      return;
    }

    // buffer内のshared bufferをpopにわたすbufにcopyする
    const b = await emptyAnalyzer.fetchFrame();

    if (!b) {
      // 準備のできたframeが存在しない場合
      await pause(Math.floor(1000 / 90 / 2));
      _emptyAnalyzers.push(emptyAnalyzer); // 返却
      return;
    }

    // console.log(`worker(main): empty worker(${emptyWorker.idx}) found, send frame`, b.idx);
    // TODO: sharedarraybufferでデータを送っているので、この辺の扱いが微妙
    // console.log('b.value', b.value);
    const msg: AnalyzeWorkerMessage = {
      idx: b.idx,
      // frame: b.value.array, // analyzebuffers[n]: sharedarraybuffer
      width: this.width,
      height: this.height,
      templates: this.enableTemplates,
    };

    try {
      emptyAnalyzer.worker.postMessage(msg);
    } catch (err) {
      console.log(err);
    }

    await pause(1); // スレッド切り
  }

  async start(width: number, height: number, scale: number) {
    console.log('start!', width, height, scale);

    this.loop = true;

    const analyzers = this.startAnalyzeWorkers();

    const recorder = this.startCaptureWorker(analyzers);

    console.log('main loop start');

    let hrprev = process.hrtime();
    let cicleTimes: [number, number][] = [];

    while (this.loop) {
      await this.mainLoop();

      if (DEBUG) {
        const hrend = process.hrtime(hrprev);
        cicleTimes.push(hrend);
        hrprev = process.hrtime();
        if (!(cicleTimes.length % 100)) {
          const avg = cicleTimes.reduce((total, t) => (total += t[1]), 0) / 100;
          console.log(`mainLoop cicle time avg: ${avg / 1000000} ms`);
          cicleTimes = [];
        }
      }
    }

    // kill recorder process.
    recorder.postMessage(null);
  }

  stop() {
    this.loop = false;
  }
}
