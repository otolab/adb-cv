import { cv } from 'opencv-wasm';
import Jimp from 'jimp';

type CVMat = any;

export function freeAll(...instances: CVMat[]) {
  instances.forEach((ins) => ins.delete());
}

export function match(snapshot: Jimp, template: CVMat, mask: CVMat = undefined, threshold: number | undefined = 0.8) {
  const _mask = new cv.Mat();
  mask = _mask; // 上手く動かないので上書きして保留

  const dst = new cv.Mat();

  const { width, height } = template.size();

  cv.matchTemplate(snapshot, template, dst, cv.TM_CCOEFF_NORMED, mask || _mask);
  const result = cv.minMaxLoc(dst, mask || _mask);

  freeAll(dst, _mask);

  const { x, y } = result.maxLoc;
  let isMatch = threshold < result.maxVal;

  return {
    val: result.maxVal,
    isMatch: isMatch,
    center: {
      x: x + Math.floor(width / 2),
      y: y + Math.floor(height / 2),
    },
  };
}
