// Configuration for a batch class.
type BatchConfiguration = {
  // The maximum number of items that can be included in a single batch.
  maxSize: number;

  // The minimum delay is how long to wait between processing batches.
  // Whether parallel or not, a batch can not be sent any faster than this.
  // If unspecified, the retry minimum delay is zero.
  minimumDelay?: number;

  // How many times an individual item should be retried before considering it failed.
  // If unspecified, the retry count is zero.
  retryCount?: number;

  // The maximum number of batches that can be processed in parallel.
  // If unspecified, the level of parallelism is infinity.
  levelOfParallelism?: number;
};

export default BatchConfiguration;
