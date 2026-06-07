export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function debounce<Arguments extends unknown[]>(
  callback: (...callbackArguments: Arguments) => void,
  waitMilliseconds: number
): (...callbackArguments: Arguments) => void {
  let timeoutId: number | undefined;

  return (...callbackArguments: Arguments) => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      callback(...callbackArguments);
    }, waitMilliseconds);
  };
}
