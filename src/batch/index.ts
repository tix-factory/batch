import PromiseQueue from '../promise-queue';
import ErrorEvent from '../events/errorEvent';
import ItemErrorEvent from '../events/itemErrorEvent';
import BatchConfiguration from '../types/batchConfiguration';
import BatchItem from '../types/batchItem';
import DeferredPromise from '../types/deferredPromise';

// A class for batching and processing multiple single items into a single call.
class Batch<TItem, TResult> extends EventTarget {
  private queueMap: { [key: string]: BatchItem<TItem, TResult> } = {};
  private promiseMap: { [key: string]: DeferredPromise<TResult>[] } = {};
  private limiter: PromiseQueue<void>;
  private concurrencyHandler: PromiseQueue<void>;

  // All the batch items waiting to be processed.
  protected queueArray: BatchItem<TItem, TResult>[] = [];

  // The configuration for this batch processor.
  protected config: BatchConfiguration;

  constructor(configuration: BatchConfiguration) {
    super();

    this.config = configuration;

    this.limiter = new PromiseQueue<void>({
      levelOfParallelism: 1,
      delayInMilliseconds: configuration.minimumDelay || 0,
    });

    this.concurrencyHandler = new PromiseQueue<void>({
      levelOfParallelism: configuration.levelOfParallelism || Infinity,
    });
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
      const check = this.check.bind(this);

      // Step 1: Ensure we have a way to resolve/reject the promise for this item.
      const mergedPromise = promiseMap[key] || [];
      if (mergedPromise.length < 0) {
        this.promiseMap[key] = mergedPromise;
      }

      mergedPromise.push({ resolve, reject });

      // Step 2: Check if we have the batched item created.
      if (!queueMap[key]) {
        const remove = (item: BatchItem<TItem, TResult>) => {
          // Mark the item as completed, so we know we either resolved or rejected it.
          item.completed = true;

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
          completed: false,
          resolve(result) {
            // We're not accepting any new items for this resolution.
            remove(this);

            // Defer the resolution until after the thread resolves.
            setTimeout(() => {
              // Process anyone who applied.
              while (mergedPromise.length > 0) {
                const promise = mergedPromise.shift();
                promise?.resolve(result);
              }
            }, 0);
          },
          reject(error) {
            // Defer the resolution until after the thread resolves.
            const retryDelay =
              this.attempt <= retryCount ? getRetryDelay(this) : undefined;
            const retryAfter =
              retryDelay !== undefined
                ? performance.now() + retryDelay
                : undefined;

            // Emit an event to notify that the item failed to process.
            dispatchEvent(new ItemErrorEvent(error, this, retryAfter));

            if (retryAfter !== undefined) {
              // The item can be retried, we haven't hit the maximum number of attempts yet.
              this.retryAfter = retryAfter;

              // Ensure the check runs after the retry delay.
              setTimeout(check, retryDelay);
            } else {
              // Remove the item, and reject anyone waiting on it.
              remove(this);

              // Defer the resolution until after the thread resolves.
              setTimeout(() => {
                // Process anyone who applied.
                while (mergedPromise.length > 0) {
                  const promise = mergedPromise.shift();
                  promise?.reject(error);
                }
              }, 0);
            }
          },
        };

        queueMap[key] = batchItem;
        queueArray.push(batchItem);
      }

      // Attempt to process the queue on the next event loop.
      setTimeout(check, this.config.enqueueDeferDelay);
    });
  }

  // Batches together queued items, calls the process method.
  // Will do nothing if the config requirements aren't met.
  private check(): void {
    if (this.limiter.size > 0) {
      // Already being checked.
      return;
    }

    // We're using p-limit to ensure that multiple process calls can't be called at once.
    this.limiter.enqueue(this._check.bind(this)).catch((err) => {
      // This should be "impossible".. right?
      this.dispatchEvent(new ErrorEvent(err));
    });
  }

  // The actual implementation of the check method.
  private _check(): Promise<void> {
    const retry = this.check.bind(this);

    // Get a batch of items to process.
    const batch = this.getBatch();

    // Nothing in the queue ready to be processed.
    if (batch.length < 1) {
      return Promise.resolve();
    }

    // Update the items that we're about to process, so they don't get double processed.
    batch.forEach((item) => {
      item.attempt += 1;
      item.retryAfter = Infinity;
    });

    setTimeout(async () => {
      try {
        await this.concurrencyHandler.enqueue(this.process.bind(this, batch));
      } catch (err) {
        this.dispatchEvent(new ErrorEvent(err));
      } finally {
        batch.forEach((item) => {
          if (item.completed) {
            // Item completed its processing, nothing more to do.
            return;
          } else if (item.retryAfter > 0 && item.retryAfter !== Infinity) {
            // The item failed to process, but it is going to be retried.
            return;
          } else {
            // Item neither rejected, or completed its processing status.
            // This is a requirement, so we reject the item.
            item.reject(
              new Error(
                'Item was not marked as resolved or rejected after batch processing completed.'
              )
            );
          }
        });

        // Now that we've finished processing the batch, run the process again, just in case there's anything left.
        setTimeout(retry, 0);
      }
    }, 0);

    if (batch.length >= this.config.maxSize) {
      // We have the maximum number of items in the batch, let's make sure we kick off the process call again.
      setTimeout(retry, this.config.minimumDelay);
    }

    return Promise.resolve();
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
