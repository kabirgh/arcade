/**
 * Creates a throttled log function that logs at most once every specified interval
 * @param interval The minimum time in milliseconds between logs
 * @returns A throttled logging function
 */
export function createThrottledLog(interval: number = 1000) {
  let lastLogTime = 0;

  return function throttledLog(...args: any[]) {
    const now = Date.now();
    if (now - lastLogTime >= interval || lastLogTime === 0) {
      console.log(...args);
      lastLogTime = now;
    }
  };
}

// Usage example:
// const log = createThrottledLog(500); // Logs at most once every 500ms
// log('Some frequent event'); // Only prints once per 500ms
