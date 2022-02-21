import path from 'path';
import { cv } from 'opencv-wasm';
import { openTemplate, AreaSetting, TemplateSetting, TemplateCache, CVMat } from './template';
import { match } from './match';

export interface AreaSettings {
  [key: string]: AreaSetting;
}

let _cropCache: {
  [key: string]: CVMat;
} = {};

function cropArea(img: CVMat, name: string, areas: AreaSettings) {
  if (!name) return img;
  if (_cropCache[name]) return _cropCache[name];
  const rect = areas[name];

  const _s = img.roi(rect);
  _cropCache[name] = _s;
  return _s;
}

function freeCropCache() {
  for (const k in _cropCache) {
    _cropCache[k].delete();
  }
  _cropCache = {};
}

export interface CommonConfig {
  scale: number;
}

export interface InitSetting {
  templateSettings: TemplateSetting[];
  areaSettings: AreaSettings;
}

export interface TemplateMatchMatchResult {
  idx: number;
  name: string;
  isMatch: boolean;
  val: number;
  center: {
    x: number;
    y: number;
  };
}

export class TemplateMatch {
  templates: {
    [key: string]: TemplateCache;
  } = {};

  templateSettings: TemplateSetting[];

  areaSettings: AreaSettings;

  scale: number;

  constructor(initSetting: InitSetting, commonConfig: CommonConfig) {
    const { templateSettings, areaSettings } = initSetting;
    const { scale } = commonConfig;
    this.templateSettings = templateSettings;
    this.areaSettings = areaSettings;
    this.scale = scale;
  }

  async init() {
    for (const setting of this.templateSettings) {
      const { name, area, threshold, filePath } = setting;
      this.templates[path.basename(name)] = await openTemplate(filePath, area, threshold, this.scale);
    }
    console.log('open templates:', Object.keys(this.templates));
  }

  process(idx: number, mat: CVMat, templateNames: string[]) {
    // const keyPoints = new cv.KeyPointVector();
    // const descriptors = new cv.Mat();
    // detector.detect(mat, keyPoints);
    // detector.compute(mat, keyPoints, descriptors);
    const _mask = new cv.Mat();

    const wildcards: { name: string; templates: string[] }[] = [];

    templateNames = templateNames.flatMap((template: string): string[] => {
      if (template.endsWith('*')) {
        const tmps = Object.keys(this.templates).filter((t) => t.startsWith(template.slice(0, -1)));
        wildcards.push({
          name: template,
          templates: tmps,
        });
        return tmps;
      }
      return [template];
    });

    // const hrstart: [number, number] = process.hrtime();

    const results = templateNames.flatMap((name: string): TemplateMatchMatchResult[] => {
      let _name = name;
      if (name.startsWith('template:')) {
        name = name.slice(9);
      }
      if (name.startsWith('!')) {
        _name = name.slice(1);
      }

      if (!this.templates[_name]) return [];

      const {
        mat: tempMat,
        // origMat: origTempMat,
        // orb,
        area,
        mask,
        threshold,
      } = this.templates[_name];

      let x, y;
      const img = cropArea(mat, area, this.areaSettings);

      // fixme, add type.
      const { isMatch, val, center } = match(img, tempMat, mask || _mask, threshold);

      const rect = this.areaSettings[area] || { x: 0, y: 0 };
      x = center.x + rect.x;
      y = center.y + rect.y;

      // const orbMatchTest = orbMatch(idx, name, mat, keyPoints, descriptors, origTempMat, orb.keyPoints, orb.descriptors);
      // console.log(orbMatchTest)

      // テンプレート名に戻す
      const wildcard = wildcards.find((wildcard) => wildcard.templates.includes(name));
      if (wildcard) {
        name = wildcard.name;
        // console.log('wildcard template!', wildcard);
      }

      const result: TemplateMatchMatchResult = {
        idx,
        name,
        isMatch: name.startsWith('!') ? !isMatch : isMatch,
        val,
        center: {
          x: x / this.scale,
          y: y / this.scale,
        },
      };

      return [result];
    });

    _mask.delete();
    // keyPoints.delete();
    // descriptors.delete();

    freeCropCache();

    // const hrend = process.hrtime(hrstart);
    // console.log(`match(all) time ${hrend[0]} s, ${hrend[1] / 1000000} ms`);

    return results;
  }
}
