// Configuration for the PromiseQueue.
type PromiseQueueConfiguration = {
  // The number of promises that can be processed in parallel.
  levelOfParallelism: number;

  // The minimum delay between processing promises.
  // Promises may run in parallel, as long as this amount have time has passed between them starting.
  delayInMilliseconds?: number;
};

export default PromiseQueueConfiguration;
