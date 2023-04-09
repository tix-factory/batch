import pLimit, { LimitFunction } from 'p-limit';
import ErrorEvent from './errorEvent';
import ItemErrorEvent from './itemErrorEvent';
import BatchConfiguration from './types/batchConfiguration';
import BatchItem from './types/batchItem';
import DeferredPromise from './types/deferredPromise';

// A class for batching and processing multiple single items into a single call.
class Batch<TItem, TResult> extends EventTarget {
  private queueMap: { [key: string]: BatchItem<TItem, TResult> } = {};
  private queueArray: BatchItem<TItem, TResult>[] = [];
  private promiseMap: { [key: string]: DeferredPromise<TResult>[] } = {};
  private limiter = pLimit(1);
  private concurrencyHandler: LimitFunction;
  private nextProcessTime: number = 0;
  private config: BatchConfiguration;

  constructor(configuration: BatchConfiguration) {
    super();

    this.config = configuration;
    this.concurrencyHandler = pLimit(
      configuration.levelOfParallelism || Infinity
    );
  }

  // Enqueues an item into a batch, to be processed.
  enqueue(item: TItem): Promise<TResult> {
    return new Promise((resolve, reject) => {
      const key = this.getKey(item);
      const promiseMap = this.promiseMap;
      const queueArray = this.queueArray;
      const queueMap = this.queueMap;
      const retryCount = this.config.retryCount || 0;
      const getRetryDelay = this.getRetryDelay.bind(this);
      const dispatchEvent = this.dispatchEvent.bind(this);

      // Step 1: Ensure we have a way to resolve/reject the promise for this item.
      const mergedPromise = promiseMap[key] || [];
      if (mergedPromise.length < 0) {
        this.promiseMap[key] = mergedPromise;
      }

      mergedPromise.push({ resolve, reject });

      // Step 2: Check if we have the batched item created.
      if (!queueMap[key]) {
        const remove = (item: BatchItem<TItem, TResult>) => {
          for (let i = 0; i < queueArray.length; i++) {
            if (queueArray[i].key === key) {
              queueArray.splice(i, 1);
              break;
            }
          }

          delete promiseMap[key];
          delete queueMap[key];
        };

        const batchItem: BatchItem<TItem, TResult> = {
          key,
          value: item,
          attempt: 0,
          retryAfter: 0,
          resolve(result) {
            // Defer the resolution until after the thread resolves.
            setTimeout(() => {
              // We're not accepting any new items for this resolution.
              remove(this);

              // Process anyone who applied.
              while (mergedPromise.length > 0) {
                const promise = mergedPromise.shift();
                promise?.resolve(result);
              }
            }, 0);
          },
          reject(error) {
            // Defer the resolution until after the thread resolves.
            setTimeout(() => {
              const retryAfter =
                this.attempt <= retryCount
                  ? performance.now() + getRetryDelay(this)
                  : undefined;

              // Emit an event to notify that the item failed to process.
              dispatchEvent(new ItemErrorEvent(error, this, retryAfter));

              if (retryAfter !== undefined) {
                // The item can be retried, we haven't hit the maximum number of attempts yet.
                this.retryAfter = retryAfter;
              } else {
                // Remove the item, and reject anyone waiting on it.
                remove(this);

                // Process anyone who applied.
                while (mergedPromise.length > 0) {
                  const promise = mergedPromise.shift();
                  promise?.reject(error);
                }
              }
            }, 0);
          },
        };

        queueMap[key] = batchItem;
        queueArray.push(batchItem);
      }

      // Attempt to process the queue on the next event loop.
      setTimeout(() => this.check(), 0);
    });
  }

  // Batches together queued items, calls the process method.
  // Will do nothing if the config requirements aren't met.
  check(): void {
    // We're using p-limit to ensure that multiple process calls can't be called at once.
    this.limiter(this._check.bind(this)).catch((err) => {
      // This should be impossible.. right?
      this.dispatchEvent(new ErrorEvent(err));
    });
  }

  // The actual implementation of the check method.
  _check() {
    const retry = this.check.bind(this);

    // Check if the minimum amount of time between batches has been reached.
    const now = performance.now();
    const remainingTime = this.nextProcessTime - now;
    if (remainingTime > 0) {
      // We haven't waited our minimum amount of time between processing intervals, yet.
      setTimeout(retry, remainingTime);
      return;
    }

    // Get a batch of items to process.
    const batch = this.getBatch();
    if (batch.length < 1) {
      // Nothing in the queue to be processed.
      return;
    }

    // Update the items that we're about to process, so they don't get double processed.
    batch.forEach((item) => {
      item.attempt += 1;
      item.retryAfter = Infinity;
    });

    if (this.config.minimumDelay) {
      this.nextProcessTime = now + this.config.minimumDelay;
    }

    setTimeout(async () => {
      try {
        await this.concurrencyHandler(this.process.bind(this, batch));
      } catch (err) {
        this.dispatchEvent(new ErrorEvent(err));
      }
    }, 0);

    if (batch.length >= this.config.maxSize) {
      // We have the maximum number of items in the batch, let's make sure we kick off the process call again.
      setTimeout(retry, this.config.minimumDelay);
    }
  }

  getBatch(): BatchItem<TItem, TResult>[] {
    const now = performance.now();
    const batch: BatchItem<TItem, TResult>[] = [];

    for (let i = 0; i < this.queueArray.length; i++) {
      const batchItem = this.queueArray[i];
      if (batchItem.retryAfter > now) {
        // Item is not ready to be retried, or it is currently being processed.
        continue;
      }

      batch.push(batchItem);

      if (batch.length >= this.config.maxSize) {
        break;
      }
    }

    return batch;
  }

  // Obtains a unique key to identify the item.
  // This is used to deduplicate the batched items.
  getKey(item: TItem): string {
    return item === undefined ? 'undefined' : JSON.stringify(item);
  }

  // Returns how long to wait before retrying the item.
  getRetryDelay(item: BatchItem<TItem, TResult>): number {
    return 0;
  }

  // Called when it is time to process a batch of items.
  process(items: BatchItem<TItem, TResult>[]): Promise<void> {
    return Promise.reject(
      new Error('Inherit this class, and implement the processBatch method.')
    );
  }
}

export default Batch;
