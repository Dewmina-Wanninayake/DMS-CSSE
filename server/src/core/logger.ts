/** Minimal logger so application code never calls `console` directly. */
export interface Logger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

/* eslint-disable no-console */
export const consoleLogger: Logger = {
  info: (message, meta) => console.info(message, ...(meta === undefined ? [] : [meta])),
  warn: (message, meta) => console.warn(message, ...(meta === undefined ? [] : [meta])),
  error: (message, meta) => console.error(message, ...(meta === undefined ? [] : [meta])),
};

export const silentLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
