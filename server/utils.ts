function logInfo(...data: any[]) {
  console.log(`[${new Date().toLocaleTimeString()}]`, ...data);
}

function logError(...data: any[]) {
  console.error(`[${new Date().toLocaleTimeString()}]`, ...data);
}

export { logError, logInfo };
