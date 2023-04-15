// An event class which can be used to emit an error.
class ErrorEvent extends Event {
  // The error associated with the event.
  error: any;

  // Constructs the event from the error.
  constructor(error: any) {
    super('error');
    this.error = error;
  }
}

export default ErrorEvent;
