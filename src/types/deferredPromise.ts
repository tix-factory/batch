// Deferred promise resolution methods.
type DeferredPromise<TResult> = {
  // The promise resolve
  resolve: (result: TResult) => void;

  // The promise rejection
  reject: (error: any) => void;
};

export default DeferredPromise;
