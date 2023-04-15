import { assertPending } from '../test-utils/promise';
import ItemErrorEvent from '../events/itemErrorEvent';
import {
  TestBatcher,
  badItem,
  badItemError,
  goodItem,
  goodItemResult,
  retryError,
  retryOnceItem,
  retryOnceResult,
} from './batch.mock';

describe('levelOfParallelism', () => {
  it('must process one batch at a time', async () => {
    const testBatcher = new TestBatcher({
      maxSize: 1,
      levelOfParallelism: 1,
      retryCount: 1,
    });

    const otherErrors: any[] = [];
    const errorEvents: ItemErrorEvent<number, string>[] = [];

    testBatcher.addEventListener('error', (e) => {
      if (e instanceof ItemErrorEvent) {
        errorEvents.push(e);
      } else {
        otherErrors.push(e);
      }
    });

    const a = testBatcher.enqueue(goodItem);
    const b = testBatcher.enqueue(badItem);
    const c = testBatcher.enqueue(retryOnceItem);

    const aResult = await a;
    expect(aResult).toBe(goodItemResult);
    assertPending(b);
    assertPending(c);

    try {
      await b;
    } catch (e) {
      expect(e).toBe(badItemError);
    }

    assertPending(c);

    const cResult = await c;
    expect(cResult).toBe(retryOnceResult);
    expect(otherErrors).toEqual([]);
    expect(errorEvents.map((e) => e.batchItem.value)).toEqual([
      badItem,
      retryOnceItem,
      badItem,
    ]);
    expect(errorEvents.map((e) => e.error)).toEqual([
      badItemError,
      retryError,
      badItemError,
    ]);
  });
});
