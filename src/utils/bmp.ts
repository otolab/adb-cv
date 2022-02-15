import fs from 'fs';
import { cv } from 'opencv-wasm';
import bmp from 'bmp-js';

type Mat = any;

// RGB24 => ARGB32
function conv3to4(m: Mat, width: number, height: number, freeOldMat = false) {
  const m2 = new cv.Mat();
  const mv = new cv.MatVector();
  const mv2 = new cv.MatVector();
  const alpha = cv.Mat.zeros(height, width, cv.CV_8UC1);

  cv.split(m, mv);
  mv2.push_back(alpha);
  mv2.push_back(mv.get(0));
  mv2.push_back(mv.get(1));
  mv2.push_back(mv.get(2));
  cv.merge(mv2, m2);

  mv.delete();
  mv2.delete();
  alpha.delete();
  if (freeOldMat) m.delete();

  return m2;
}

export async function matToBitmap(fname: string, mat: Mat) {
  const { width, height } = mat.size();
  const channels = mat.channels();
  let data: Buffer = mat.data;

  if (channels == 3) {
    const m = conv3to4(mat, width, height);
    data = m.data;
  }

  const bmpData = bmp.encode({
    data,
    // data: new Uint8ClampedArray(data),
    width: width,
    height: height,
  });

  await fs.promises.writeFile(fname, bmpData.data);
}
