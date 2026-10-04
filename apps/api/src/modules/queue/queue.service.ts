import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, JobsOptions, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { AppConfig } from '../../config/app.config';

export const QUEUES = { research: 'research', facts: 'fact-research' } as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

type Handler<T> = (job: Job<T>) => Promise<void>;

/** Single place that owns Redis connections; every pipeline queue runs with concurrency 1. */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection: IORedis;
  private readonly queues = new Map<QueueName, Queue>();
  private readonly workers: Array<{ worker: Worker; connection: IORedis }> = [];

  constructor(config: ConfigService<AppConfig, true>) {
    this.connection = new IORedis(config.get('redisUrl', { infer: true }), { maxRetriesPerRequest: null });
  }

  async add<T extends object>(name: QueueName, data: T, opts: JobsOptions = {}) {
    await this.queue(name).add(name, data, { removeOnComplete: 100, removeOnFail: 100, ...opts });
  }

  work<T>(name: QueueName, handler: Handler<T>) {
    const connection = this.connection.duplicate();
    const worker = new Worker<T>(name, handler, { connection, concurrency: 1 });
    worker.on('failed', (job, err) => this.logger.error(`${name} job ${job?.id} failed: ${err.message}`));
    this.workers.push({ worker, connection });
  }

  async counts(): Promise<{ running: number; queued: number }> {
    let running = 0;
    let queued = 0;
    for (const name of Object.values(QUEUES)) {
      const c = await this.queue(name).getJobCounts('active', 'waiting', 'delayed', 'prioritized');
      running += c.active ?? 0;
      queued += (c.waiting ?? 0) + (c.delayed ?? 0) + (c.prioritized ?? 0);
    }
    return { running, queued };
  }

  /** BullMQ does not close connections it was given, so they are released here. */
  async onModuleDestroy() {
    await Promise.all(this.workers.map(({ worker }) => worker.close()));
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    await Promise.all([this.connection, ...this.workers.map((w) => w.connection)].map((c) => c.quit()));
  }

  private queue(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      q = new Queue(name, { connection: this.connection });
      this.queues.set(name, q);
    }
    return q;
  }
}
