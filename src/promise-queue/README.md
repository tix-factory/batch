# :books: PromiseQueue<T>

This class can be used to execute promises in paralell, at a specified rate of parallelism.

# :petri_dish: Sample

```ts
// Create the object to enqueue promises with.
const promiseQueue = new PromiseQueue({
  // How many enqueued promises can be executed in parallel.
  levelOfParallelism: 1,

  // How long to wait between starting to process the enqeueued promises.
  // Defaults to zero.
  delayInMilliseconds: 500,
});

const delay = (delayInMilliseconds: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), delayInMilliseconds);
  });
};

const startTime = performance.now();
const logs: string[] = [];

const log = (message: string) => {
  logs.push(`${Math.floor(performance.now() - startTime)}: ${message}`);
};

const a = promiseQueue.enqueue(async () => {
  log('booting...');
  await delay(250);
  log('Hello, world!');
});

const b = promiseQueue.enqueue(async () => {
  log('b here');
  await delay(750);
  log('b stands for bob');
});

const c = promiseQueue.enqueue(async () => {
  // the delay in milliseconds is 500, and the previous promise took 750 to execute
  // which means the delay has been exceeded by the time this promise starts executing
  log('immediate');
});

await Promise.all([a, b, c]);

log('done');
console.log('>', logs.join('\n> '));
```

It may not be the fastest... but it works.

```
> 0: booting...
> 263: Hello, world!
> 511: b here
> 1269: b stands for bob
> 1285: immediate
> 1285: done
```

Sometimes the JavaScript event loop can be slow, which this library relies on.
