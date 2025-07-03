// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logInfo(...data: any[]) {
  console.log(`[${new Date().toLocaleTimeString()}]`, ...data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logWarn(...data: any[]) {
  console.warn(`[${new Date().toLocaleTimeString()}]`, ...data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logError(...data: any[]) {
  console.error(`[${new Date().toLocaleTimeString()}]`, ...data);
}
