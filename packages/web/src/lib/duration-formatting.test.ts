import { describe, expect, test } from "bun:test";
import {
  formatCompactDuration,
  formatDowntimeDuration,
} from "./duration-formatting";

describe("formatCompactDuration", () => {
  test("formats minutes", () => {
    expect(formatCompactDuration(30 * 60 * 1000)).toBe("30m");
    expect(formatCompactDuration(1 * 60 * 1000)).toBe("1m");
    expect(formatCompactDuration(59 * 60 * 1000)).toBe("59m");
  });

  test("formats hours", () => {
    expect(formatCompactDuration(2 * 60 * 60 * 1000)).toBe("2h");
    expect(formatCompactDuration(1 * 60 * 60 * 1000)).toBe("1h");
    expect(formatCompactDuration(23 * 60 * 60 * 1000)).toBe("23h");
  });

  test("formats days", () => {
    expect(formatCompactDuration(1 * 24 * 60 * 60 * 1000)).toBe("1d");
    expect(formatCompactDuration(3 * 24 * 60 * 60 * 1000)).toBe("3d");
    expect(formatCompactDuration(30 * 24 * 60 * 60 * 1000)).toBe("30d");
  });

  test("rounds down to nearest unit", () => {
    expect(formatCompactDuration(90 * 60 * 1000)).toBe("1h"); // 90 minutes = 1 hour
    expect(formatCompactDuration(25 * 60 * 60 * 1000)).toBe("1d"); // 25 hours = 1 day
  });
});

describe("formatDowntimeDuration", () => {
  test("formats just now for < 1 minute", () => {
    expect(formatDowntimeDuration(0)).toBe("just now");
    expect(formatDowntimeDuration(30 * 1000)).toBe("just now");
    expect(formatDowntimeDuration(59 * 1000)).toBe("just now");
  });

  test("formats minutes with pluralization", () => {
    expect(formatDowntimeDuration(1 * 60 * 1000)).toBe("1 minute");
    expect(formatDowntimeDuration(2 * 60 * 1000)).toBe("2 minutes");
    expect(formatDowntimeDuration(30 * 60 * 1000)).toBe("30 minutes");
  });

  test("formats hours with pluralization", () => {
    expect(formatDowntimeDuration(1 * 60 * 60 * 1000)).toBe("1 hour");
    expect(formatDowntimeDuration(2 * 60 * 60 * 1000)).toBe("2 hours");
    expect(formatDowntimeDuration(12 * 60 * 60 * 1000)).toBe("12 hours");
  });

  test("formats days with pluralization", () => {
    expect(formatDowntimeDuration(1 * 24 * 60 * 60 * 1000)).toBe("1 day");
    expect(formatDowntimeDuration(2 * 24 * 60 * 60 * 1000)).toBe("2 days");
    expect(formatDowntimeDuration(7 * 24 * 60 * 60 * 1000)).toBe("7 days");
  });
});
