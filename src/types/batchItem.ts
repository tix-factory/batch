// Represents information about an individual batched item.
type BatchItem<TItem, TResult> = {
  // A unique identifier for the batched item.
  key: string;

  // The batched item itself.
  value: TItem;

  // How many times the item has attempted to be processed.
  attempt: number;

  // The time when the item can be retried.
  // This will be set to infinity while the item is being processed.
  retryAfter: number;

  // Whether or not the item completed processing.
  completed: boolean;

  // Resolves the batched item, confirming its value.
  resolve: (result: TResult) => void;

  // Rejects the batched item,
  reject: (error: any) => void;
};

export default BatchItem;
