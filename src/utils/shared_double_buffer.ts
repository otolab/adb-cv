import { promisify } from 'util';
const pause = promisify(setTimeout);

interface SharedObject {
  _state: SharedArrayBuffer;
  _idxs: SharedArrayBuffer[];
  _bufs: SharedArrayBuffer[];
}

export class DoubleBuffer {
  size: number;
  shared: SharedObject;
  state: Uint8Array;
  idxs: Uint16Array[];

  constructor(size: number, shared: SharedObject | null = null) {
    this.size = size;
    this.shared = shared || {
      _state: new SharedArrayBuffer(2),
      _idxs: [new SharedArrayBuffer(2), new SharedArrayBuffer(2)],
      _bufs: [new SharedArrayBuffer(size), new SharedArrayBuffer(size)],
    };
    this.state = new Uint8Array(this.shared._state);
    this.idxs = [new Uint16Array(this.shared._idxs[0]), new Uint16Array(this.shared._idxs[1])];

    // 書き込み可能状態からスタート
    if (!shared) {
      this.updatable(0, true);
      this.updatable(1, true);
    }
  }

  updatable(i: number, f: boolean) {
    this.state.set([f ? 1 : 0], i);
  }

  isUpdatable(i: number) {
    return this.state[i] ? true : false;
  }

  truncate() {
    for (let i = 0; i < 2; i++) {
      this.updatable(i, true);
    }
  }

  async pop(buf: Buffer | ArrayBuffer) {
    let i;
    for (i = 0; i < 2; i++) {
      if (!this.isUpdatable(i)) {
        break;
      }
    }
    if (i >= 2) {
      return null;
    }

    const array = new Uint8Array(buf);
    const srcArray = new Uint8Array(this.shared._bufs[i]);

    array.set(srcArray);

    // const copySize = 32 * 1024;
    // let offset = 0;
    // while (offset < srcArray.length) {
    //   const size = Math.min([copySize, srcArray.length - offset]);
    //   array.set(srcArray.subarray(offset, size), offset);
    //   offset += size;
    //   await pause(1);
    // }

    // copy
    const ret = {
      array,
      idx: 0 + this.idxs[i][0],
    };

    this.updatable(i, true);
    return ret;
  }

  async put(idx: number, chunks: Buffer[]) {
    for (let i = 0; i < 2; i++) {
      if (!this.isUpdatable(i)) continue;

      const buf = new Uint8Array(this.shared._bufs[i]);
      let offset = 0;
      let hrprev = process.hrtime();

      // let hrstart = hrprev;
      // let n = 0;

      for (let j = 0; j < chunks.length; j++) {
        buf.set(chunks[j], offset);
        offset += chunks[j].length;

        // 1ms以上書き込みを続けていた場合はスレッドを切る
        if ((process.hrtime()[1] - hrprev[1]) / 1000000 > 0.5) {
          hrprev = process.hrtime();
          // n++;
          await pause(0);
        }
      }

      // if (n>0) console.log('copy thread:', idx, ', cut:', n, chunks.length);
      // console.log('put total:', idx, process.hrtime()[1] - hrstart[1], n);

      this.idxs[i].set([idx]);

      this.updatable(i, false);
      return buf;
    }

    return null;
  }

  generateIter(buffer: Buffer | ArrayBuffer | null, time = 100) {
    const self = this;
    async function* gen(buffer: Buffer | ArrayBuffer | null, time: number) {
      if (!buffer) buffer = new ArrayBuffer(self.size);
      while (true) {
        const ret = await self.pop(buffer);
        if (ret) {
          yield ret;
        } else {
          yield null;
        }
        await pause(time);
      }
    }
    return gen(buffer, time);
  }
}
