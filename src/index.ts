import { LookWorker } from './watcher';

export function create(width: number, height: number, scale: number) {
  return new LookWorker(width, height, scale);
}

// const SCALE = 0.5;
// const WIDTH = 1080 * SCALE;
// const HEIGHT = 2340 * SCALE;

//   const templates = [
//     // ['button-ok'],
//   ];

//   const plugins = {
//     'template-match': {
//       templates
//     }
//   };

//   start(WIDTH, HEIGHT, SCALE, plugins)
