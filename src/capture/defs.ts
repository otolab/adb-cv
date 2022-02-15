export type CaptureMode = 'stream' | 'snapshot';

export interface RecorderContext {
  // width: number;
  // height: number;
  idx: number;
  session: number;
  mode: CaptureMode;
  chunks: any[] | null;
}
