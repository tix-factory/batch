// A type to represent a function that returns a promise.
type PromiseFactory<TResult> = () => Promise<TResult>;
export default PromiseFactory;
