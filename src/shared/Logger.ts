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

  public static debug(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(
        `%c[DEBUG]%c ${message}`,
        "color: #7f8c8d; font-weight: bold;",
        "",
        ...args,
      );
    }
  }

  public static info(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(
        `%c[INFO]%c ${message}`,
        "color: #2ecc71; font-weight: bold;",
        "",
        ...args,
      );
    }
  }

  public static warn(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(
        `%c[WARN]%c ${message}`,
        "color: #f39c12; font-weight: bold;",
        "",
        ...args,
      );
    }
  }

  public static error(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(
        `%c[ERROR]%c ${message}`,
        "color: #e74c3c; font-weight: bold;",
        "",
        ...args,
      );
    }
  }
}

// Expose to window for runtime adjustment in browser
if (typeof window !== "undefined") {
  (window as unknown as { Logger: typeof Logger }).Logger = Logger;
}