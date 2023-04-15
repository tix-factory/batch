import { inspect } from 'util';

const delayTime = 100;

// Create a promise that will resolve, or reject, after a delay.
const delayedPromise = (
  result: any,
  delay: number = delayTime
): Promise<any> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (result instanceof Error) {
        reject(result);
      } else {
        resolve(result);
      }
    }, delay);
  });
};

// Asserts that a promise is currently pending.
const assertPending = (promise: Promise<any>) => {
  expect(inspect(promise)).toContain('<pending>');
};

export { delayTime, delayedPromise, assertPending };
