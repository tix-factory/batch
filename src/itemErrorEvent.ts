import ErrorEvent from './errorEvent';
import BatchItem from './types/batchItem';

// An event class which can be used to emit an error event for an item that failed to process.
class ItemErrorEvent<TItem, TResult> extends ErrorEvent {
  // The item that failed to process.
  batchItem: BatchItem<TItem, TResult>;

  // The amount of time when the item will be retried.
  retryAfter?: number;

  // Constructs the event from the error.
  constructor(
    error: any,
    batchItem: BatchItem<TItem, TResult>,
    retryAfter?: number
  ) {
    super(error);
    this.batchItem = batchItem;
    this.retryAfter = retryAfter;
  }
}

export default ItemErrorEvent;
