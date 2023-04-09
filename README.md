# :shopping_cart: @tix-factory/batch

This module was created with the intention of merging multiple outbound fetch calls into a single outbound fetch call.

# :petri_dish: Example

```ts
import { Batch, BatchItem } from '@tix-factory/batch';

class ItemBatcher<number, string> extends Batch {
  constructor() {
    super({});
  }

  process(items: BatchItem<number, string>[]): Promise<void> {
    // All enqueued items getting processed at once.
    items.forEach((item) => {
      item.resolve(`Hello, ${item.value}`);
    });

    // Items must have either called resolve or reject before this method returns.
    return Promise.resolve();
  }
}

const batcher = new ItemBatcher();

const a = batcher.enqueue(123);
const b = batcher.enqueue(456);

Promise.all([a, b])
  .then((results) => {
    console.log(results);
  })
  .catch((err) => {
    console.error(err);
  });
```
