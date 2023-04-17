import PromiseQueue from '.';
import {
  delayedPromise,
  delayTime,
  assertPending,
} from '../test-utils/promise';

describe('PromiseQueue', () => {
  it('Should only execute one promise at a time.', async () => {
    const promiseQueue = new PromiseQueue<string>({ levelOfParallelism: 1 });
    const a = promiseQueue.enqueue(() => delayedPromise('a'));
    const b = promiseQueue.enqueue(() => delayedPromise('b'));
    const c = promiseQueue.enqueue(() => delayedPromise(new Error('c')));

    assertPending(a);
    assertPending(b);
    assertPending(c);

    const aResult = await a;
    expect(aResult).toBe('a');
    assertPending(b);
    assertPending(c);

    const bResult = await b;
    expect(bResult).toBe('b');
    assertPending(c);

    try {
      await c;
      fail('Expected c to throw');
    } catch (e) {
      if (e instanceof Error) {
        expect(e.message).toBe('c');
      } else {
        fail('Expected c to reject with an error');
      }
    }
  });

  it('Should allow multiple promises to run at the same time', async () => {
    const promiseQueue = new PromiseQueue<string>({ levelOfParallelism: 2 });
    const running = new Set<string>();

    const a = promiseQueue.enqueue(async () => {
      running.add('a');
      const r = await delayedPromise('a');
      running.delete('a');
      return r;
    });

    const b = promiseQueue.enqueue(async () => {
      running.add('b');
      const r = await delayedPromise('b', delayTime * 2);
      running.delete('b');
      return r;
    });

    const c = promiseQueue.enqueue(async () => {
      running.add('c');
      try {
        return await delayedPromise(new Error('c'));
      } finally {
        running.delete('c');
      }
    });

    assertPending(a);
    assertPending(b);
    assertPending(c);

    expect(Array.from(running)).toEqual(['a', 'b']);

    const aResult = await a;
    expect(aResult).toBe('a');

    await delayedPromise('', 0);
    expect(Array.from(running)).toEqual(['b', 'c']);

    const bResult = await b;
    expect(bResult).toBe('b');

    expect(Array.from(running)).toEqual(['c']);

    try {
      await c;
      fail('Expected c to throw');
    } catch (e) {
      if (e instanceof Error) {
        expect(e.message).toBe('c');
      } else {
        fail('Expected c to reject with an error');
      }
    } finally {
      // Ensure we're not running any promises.
      expect(Array.from(running)).toEqual([]);
    }
  });

  it('Should not wait between running queued promises', async () => {
    const promiseQueue = new PromiseQueue<string>({ levelOfParallelism: 2 });
    const start = performance.now();
    const a = promiseQueue.enqueue(() => delayedPromise('a'));
    const b = promiseQueue.enqueue(() => delayedPromise('b'));

    await a;
    await b;

    const time = performance.now() - start;

    // Adjust times because the event loop can run slightly faster than the exact specified time,
    // or sometimes slightly over.
    expect(time).toBeGreaterThanOrEqual(delayTime * 0.95);
    expect(time).toBeLessThanOrEqual(delayTime * 1.2);
  });

  it('Should wait between running queued promises', async () => {
    const promiseQueue = new PromiseQueue<string>({
      levelOfParallelism: 2,
      delayInMilliseconds: delayTime / 2,
    });
    const start = performance.now();
    const a = promiseQueue.enqueue(() => delayedPromise('a'));
    const b = promiseQueue.enqueue(() => delayedPromise('b'));

    await a;
    await b;

    const time = performance.now() - start;
    expect(time).toBeGreaterThanOrEqual(delayTime * 1.5);
    expect(time).toBeLessThanOrEqual(delayTime * 2);
  });
});
