import { Batch, BatchConfiguration, BatchItem, ErrorEvent } from '../';
import { delayedPromise, delayTime } from '../test-utils/promise';

// Test data.
const goodItem = 48103520;
const goodItemResult = 'Hello, world!';

const badItem = 3336955;
const badItemError = new Error(
  `His palms are sweaty, knees weak, arms are heavy`
);

const retryOnceItem = 30519557;
const retryError = new Error(`He won't give up that easy`);
const retryOnceResult = 'Look, if you had one shot, or one opportunity';

// The batch class implementation, as we can expect the consumer of this package to use this.
class TestBatcher extends Batch<number, string> {
  private processDelay: number;

  constructor(config: BatchConfiguration, processDelay: number = delayTime) {
    super(config);
    this.processDelay = processDelay;

    /*
    this.addEventListener('error', (event) => {
      if (event instanceof ErrorEvent) {
        console.error('Error logged by batch class', event.error);
      } else {
        console.error('Unknown error event', event);
      }
    });
    */
  }

  async process(items: BatchItem<number, string>[]): Promise<void> {
    const promises = items.map(async (item) => {
      await delayedPromise('', this.processDelay);

      switch (item.value) {
        case goodItem:
          item.resolve(goodItemResult);
          return;
        case retryOnceItem:
          if (item.attempt === 1) {
            item.reject(retryError);
          } else {
            item.resolve(retryOnceResult);
          }

          return;
        case badItem:
          item.reject(badItemError);
          return;
        default:
          throw new Error('Unrecognized item in the queue. Tests are bad.');
      }
    });

    await Promise.all(promises);
  }
}

export {
  goodItem,
  goodItemResult,
  badItem,
  badItemError,
  retryOnceItem,
  retryError,
  retryOnceResult,
  TestBatcher,
};
