import DeferredPromise from './deferredPromise';
import PromiseFactory from './promiseFactory';

// Represents a promise on the queue.
type QueuedPromise<TResult> = {
  // The deferred promise details.
  deferredPromise: DeferredPromise<TResult>;

  // Create the promise to actually be run.
  createPromise: PromiseFactory<TResult>;
};

export default QueuedPromise;
