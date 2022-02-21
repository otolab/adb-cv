import { cv } from 'opencv-wasm';
import Jimp from 'jimp';

export type CVMat = any;

export type CVRect = any;

export interface TemplateSetting {
  name: string;
  area: string | undefined;
  threshold: number | undefined;
  filePath: string;
}

export type AreaSetting = CVRect;

export interface TemplateCache {
  mat: CVMat;
  origMat: CVMat;

  area: CVRect;
  threshold: number;

  orb: any; // fixme

  mask: CVMat;
}

// RGBAをBGAに変換
function conv(snapshot: Jimp) {
  // const { width, height } = snapshot.bitmap;
  // const alpha = cv.matFromArray(height, width, cv.CV_8UC1, []);
  const m = cv.matFromImageData(snapshot.bitmap);
  const m2 = new cv.Mat();
  const mv = new cv.MatVector();
  const mv2 = new cv.MatVector();
  cv.split(m, mv);
  // mv2.push_back(mv.get(3)); // alpha channelは残さない
  mv2.push_back(mv.get(2));
  mv2.push_back(mv.get(1));
  mv2.push_back(mv.get(0));
  cv.merge(mv2, m2);
  return m2;
}

/**
 * 返り値は必ず開放すること
 */
async function readTemplateImage(path: string, scale: number = 1) {
  const img = await Jimp.read(path);
  if (scale !== 1) {
    img.resize(Math.floor(img.bitmap.width * scale), Jimp.AUTO);
  }
  return conv(img);
}

const detector = new cv.ORB();

export async function openTemplate(
  path: string,
  area: CVRect,
  threshold: number | undefined,
  scale: number
): Promise<TemplateCache> {
  const mat = await readTemplateImage(path, scale);
  const origMat = await readTemplateImage(path);

  const keyPoints = new cv.KeyPointVector();
  const descriptors = new cv.Mat();
  detector.detect(origMat, keyPoints);
  detector.compute(origMat, keyPoints, descriptors);

  return {
    mat,
    origMat,
    // blurMat,
    area,
    threshold: threshold || 0.8,
    orb: {
      keyPoints,
      descriptors,
    },
    mask: null,
  };
}
