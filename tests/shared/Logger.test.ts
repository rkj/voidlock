import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger, LogLevel } from "@src/shared/Logger";

describe("Logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should respect LogLevel setting", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    Logger.setLevel(LogLevel.INFO);
    Logger.debug("test debug");
    Logger.info("test info");

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      "%c[INFO]%c test info",
      "color: #2ecc71; font-weight: bold;",
      "",
    );
  });

  it("should log all levels when set to DEBUG", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    Logger.setLevel(LogLevel.DEBUG);
    Logger.debug("d");
    Logger.info("i");
    Logger.warn("w");
    Logger.error("e");

    expect(debugSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("should log nothing when set to NONE", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    Logger.setLevel(LogLevel.NONE);
    Logger.info("i");
    Logger.error("e");

    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});