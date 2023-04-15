import PromiseFactory from '../types/promiseFactory';
import QueuedPromise from '../types/queuedPromise';

// A limiter for running promises in parallel.
// Queue ensures order is maintained.
class PromiseQueue<TResult> {
  // All the promises that have been enqueued, and are waiting to be processed.
  private queue: QueuedPromise<TResult>[] = [];

  // The number of promises that can be processed in parallel.
  private levelOfParallelism: number;

  // The minimum delay between processing promises.
  // Promises may run in parallel, as long as this amount have time has passed between them starting.
  private delayInMilliseconds: number;

  // How many promises are actively being processed.
  private activeCount: number = 0;

  // The next time a promise can be processed.
  private nextProcessTime: number = 0;

  // Constructs a promise queue, defining the number of promises that may run in parallel.
  constructor(levelOfParallelism: number, delayInMilliseconds: number = 0) {
    this.levelOfParallelism = levelOfParallelism;
    this.delayInMilliseconds = delayInMilliseconds;
  }

  // The number of promises waiting to be processed.
  get size(): number {
    return this.queue.length;
  }

  // Puts a function that will create the promise to run on the queue, and returns a promise
  // that will return the result of the enqueued promise.
  enqueue(createPromise: PromiseFactory<TResult>): Promise<TResult> {
    return new Promise(async (resolve, reject) => {
      this.queue.push({
        deferredPromise: { resolve, reject },
        createPromise,
      });

      await this.process();
    });
  }

  async process(): Promise<void> {
    if (this.activeCount >= this.levelOfParallelism) {
      // Already running max number of promises in parallel.
      return;
    }

    const reprocess = this.process.bind(this);

    if (this.delayInMilliseconds > 0) {
      const now = performance.now();
      const remainingTime = this.nextProcessTime - now;
      if (remainingTime > 0) {
        // We're not allowed to process the next promise yet.
        setTimeout(reprocess, remainingTime);
        return;
      }

      this.nextProcessTime = now + this.delayInMilliseconds;
    }

    const promise = this.queue.shift();
    if (!promise) {
      // No promise to process.
      return;
    }

    this.activeCount++;

    try {
      const result = await promise.createPromise();
      promise.deferredPromise.resolve(result);
    } catch (err) {
      promise.deferredPromise.reject(err);
    } finally {
      // Ensure we subtract from how many promises are active
      this.activeCount--;

      // And then run the process function again, in case there are any promises left to run.
      setTimeout(reprocess, 0);
    }
  }
}

export default PromiseQueue;
