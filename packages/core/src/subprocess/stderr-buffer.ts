/**
 * Circular buffer for stderr output with byte and line limits
 *
 * Prevents memory exhaustion from misbehaving processes by:
 * - Truncating extremely long lines
 * - Enforcing byte limit (10MB default)
 * - Enforcing line count limit (1000 default)
 */
export class StderrBuffer {
  private buffer: string[] = [];
  private byteCount = 0;

  constructor(
    private readonly maxLines = 1000,
    private readonly maxBytes = 10 * 1024 * 1024, // 10 MB
    private readonly maxLineLength = 10000,
  ) {}

  /**
   * Add line to buffer with automatic truncation and eviction
   */
  push(line: string): void {
    // Truncate extremely long lines
    const truncated =
      line.length > this.maxLineLength
        ? `${line.substring(0, this.maxLineLength)}...[truncated ${line.length - this.maxLineLength} chars]`
        : line;

    this.buffer.push(truncated);
    this.byteCount += truncated.length;

    // Evict old lines if byte limit exceeded
    this.evictByBytes();

    // Evict old lines if line count exceeded
    this.evictByLines();
  }

  /**
   * Get all buffered lines
   */
  getLines(): string[] {
    return this.buffer;
  }

  /**
   * Clear all buffered lines
   */
  clear(): void {
    this.buffer = [];
    this.byteCount = 0;
  }

  /**
   * Evict oldest lines until byte limit is satisfied
   */
  private evictByBytes(): void {
    while (this.byteCount > this.maxBytes && this.buffer.length > 0) {
      const removed = this.buffer.shift();
      if (removed) {
        this.byteCount -= removed.length;
      }
    }
  }

  /**
   * Evict oldest lines until line count limit is satisfied
   */
  private evictByLines(): void {
    if (this.buffer.length > this.maxLines) {
      const toRemove = this.buffer.length - this.maxLines;
      for (let i = 0; i < toRemove; i++) {
        const removed = this.buffer.shift();
        if (removed) {
          this.byteCount -= removed.length;
        }
      }
    }
  }
}
