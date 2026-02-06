export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export class Logger {
  private static level: LogLevel = LogLevel.INFO;

  static {
    // Determine default log level based on environment
    const isProd =
      (typeof import.meta !== "undefined" && import.meta.env?.PROD) ||
      (typeof process !== "undefined" && process.env?.NODE_ENV === "production");
    this.level = isProd ? LogLevel.ERROR : LogLevel.INFO;
  }

  public static setLevel(level: LogLevel): void {
    this.level = level;
  }

  public static getLevel(): LogLevel {
    return this.level;
  }

  private static useStyling(): boolean {
    // Only use styling in browser and NOT in vitest environment
    const isBrowser = typeof window !== "undefined";
    const isVitest =
      typeof process !== "undefined" &&
      (process.env?.VITEST === "true" || !!process.env?.VITEST);
    return isBrowser && !isVitest;
  }

  private static isVitest(): boolean {
    return (
      typeof process !== "undefined" &&
      (process.env?.VITEST === "true" || !!process.env?.VITEST)
    );
  }

  public static debug(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      if (this.useStyling()) {
        console.debug(
          `%c[DEBUG]%c ${message}`,
          "color: #7f8c8d; font-weight: bold;",
          "",
          ...args,
        );
      } else if (this.isVitest()) {
        console.debug(message, ...args);
      } else {
        console.debug(`[DEBUG] ${message}`, ...args);
      }
    }
  }

  public static info(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      if (this.useStyling()) {
        console.info(
          `%c[INFO]%c ${message}`,
          "color: #2ecc71; font-weight: bold;",
          "",
          ...args,
        );
      } else if (this.isVitest()) {
        console.info(message, ...args);
      } else {
        console.info(`[INFO] ${message}`, ...args);
      }
    }
  }

  public static warn(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      if (this.useStyling()) {
        console.warn(
          `%c[WARN]%c ${message}`,
          "color: #f39c12; font-weight: bold;",
          "",
          ...args,
        );
      } else if (this.isVitest()) {
        console.warn(message, ...args);
      } else {
        console.warn(`[WARN] ${message}`, ...args);
      }
    }
  }

  public static error(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      if (this.useStyling()) {
        console.error(
          `%c[ERROR]%c ${message}`,
          "color: #e74c3c; font-weight: bold;",
          "",
          ...args,
        );
      } else if (this.isVitest()) {
        console.error(message, ...args);
      } else {
        console.error(`[ERROR] ${message}`, ...args);
      }
    }
  }
}

// Expose to window for runtime adjustment in browser
if (typeof window !== "undefined") {
  (window as unknown as { Logger: typeof Logger }).Logger = Logger;
}
