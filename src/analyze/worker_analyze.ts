import { parentPort, workerData } from 'worker_threads';
import { cv } from 'opencv-wasm';
import {
  TemplateMatch,
  InitSetting as TemplateMatchInitSetting,
  TemplateMatchMatchResult,
} from '../plugins/template-match/index';

const BMP_HEADER_SIZE = 54;

export interface WorkerData {
  buf: SharedArrayBuffer;
  commonConfig: {
    scale: number;
  };
  pluginSettings: {
    'template-match': TemplateMatchInitSetting;
  };
}

export interface AnalyzeWorkerMessage {
  templates: string[];
  idx: number;
  width: number;
  height: number;
}

export interface MatchResults {
  idx: number;
  results: {
    'template-match': {
      results: TemplateMatchMatchResult[];
    };
  };
}

export interface AnalyzeResultMessage {
  type: string;
  results: MatchResults;
}

const {
  // 画像データが入っているshared array buffer。bgr24
  buf: sharedFrameBuf,

  commonConfig,

  pluginSettings,
}: WorkerData = workerData;

console.log('analyze worker');

function sendResults(matchResults: MatchResults) {
  if (parentPort) {
    const msg: AnalyzeResultMessage = {
      type: 'results',
      results: matchResults,
    };

    try {
      parentPort.postMessage(msg);
    } catch (err) {
      console.log(err);
    }
  }
}

(async () => {
  console.log('run analyze');

  const templateMatcher = new TemplateMatch(pluginSettings['template-match'], commonConfig);
  await templateMatcher.init();

  async function onMessage(msg: AnalyzeWorkerMessage | null) {
    // 終了させる場合はnullを渡される。仕様微妙。
    if (!msg) {
      process.exit(0);
    }

    const { templates, idx, width, height } = msg;

    // const hrstart = process.hrtime();

    const frame = new Uint8Array(sharedFrameBuf).subarray(BMP_HEADER_SIZE);
    const mat = cv.matFromArray(height, width, cv.CV_8UC3, frame);

    const templateMatchMatchResults: TemplateMatchMatchResult[] = templateMatcher.process(idx, mat, templates);

    const matchResults: MatchResults = {
      idx,
      results: {
        'template-match': {
          results: templateMatchMatchResults,
        },
      },
    };

    sendResults(matchResults);

    mat.delete();

    // const hrend = process.hrtime(hrstart)
    // console.log(`analyze time ${hrend[0]} s, ${hrend[1] / 1000000} ms`)
  }

  if (parentPort) {
    // parentからのmessageで処理が駆動される
    parentPort.on('message', onMessage);

    // 準備ができたことを通知
    try {
      parentPort.postMessage({
        type: 'ready',
      });
    } catch (err) {
      console.log(err);
    }
  }
})();
