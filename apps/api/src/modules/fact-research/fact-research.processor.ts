import { Injectable, OnModuleInit } from '@nestjs/common';
import { QUEUES, QueueService } from '../queue/queue.service';
import { FactJobData, FactResearchService } from './fact-research.service';

@Injectable()
export class FactResearchProcessor implements OnModuleInit {
  constructor(
    private readonly queue: QueueService,
    private readonly facts: FactResearchService,
  ) {}

  onModuleInit() {
    this.queue.work<FactJobData>(QUEUES.facts, (job) => this.facts.process(job.data.jobRecordId));
  }
}
