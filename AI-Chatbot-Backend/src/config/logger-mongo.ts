import Transport from 'winston-transport';
import { LogModel } from '../database/models/Log.model';

export interface MongoTransportOptions extends Transport.TransportStreamOptions {
  source: string;
}

/**
 * Winston transport that persists logs to the "logs" collection
 * so the admin panel can render a full log history. Buffered to
 * avoid overwhelming MongoDB under heavy load.
 */
export class MongoLogTransport extends Transport {
  private buffer: Array<{ level: string; message: string; meta: unknown; source: string; timestamp: Date }>;
  private source: string;
  private flushTimer: NodeJS.Timeout | null;
  private writing: boolean;

  constructor(opts: MongoTransportOptions = { source: 'app', level: 'info' }) {
    super(opts);
    this.source = opts.source || 'app';
    this.buffer = [];
    this.flushTimer = null;
    this.writing = false;
    this.setMaxListeners(0);
  }

  log(info: unknown, callback: () => void): void {
    const record = info as {
      level: string;
      message: string;
      timestamp?: string;
      stack?: string;
    };

    setImmediate(() => {
      this.emit('logged', record);
    });
    this.handleLog(record);
    callback();
  }

  private handleLog(record: { level: string; message: string; stack?: string }): void {
    this.buffer.push({
      level: record.level,
      message: record.message,
      meta: record.stack ? { stack: record.stack } : {},
      source: this.source,
      timestamp: new Date(),
    });

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), 1500);
    }
  }

  private async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.writing || !this.buffer.length) return;

    const batch = this.buffer.splice(0, this.buffer.length);
    this.writing = true;

    try {
      await LogModel.insertMany(batch as never, { ordered: false });
    } catch {
      // Log persistence failures are non-fatal.
    } finally {
      this.writing = false;
    }
  }

  async close(): Promise<void> {
    await this.flush();
  }
}