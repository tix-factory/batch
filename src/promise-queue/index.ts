import PromiseFactory from '../types/promiseFactory';
import QueuedPromise from '../types/queuedPromise';

// A limiter for running promises in parallel.
// Queue ensures order is maintained.
class PromiseQueue<TResult> {
  private queue: QueuedPromise<TResult>[] = [];
  private limit: number;
  private activeCount: number = 0;

  // Constructs a promise queue, defining the number of promises that may run in parallel.
  constructor(limit: number) {
    this.limit = limit;
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
    if (this.activeCount >= this.limit) {
      // Already running max number of promises in parallel.
      return;
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
      setTimeout(this.process.bind(this), 0);
    }
  }
}

export default PromiseQueue;
