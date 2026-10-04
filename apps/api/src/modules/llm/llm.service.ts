import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { estimateBasicAnalysisCost } from '@youtube-ai-tool/shared';
import type { z } from 'zod';
import { errorMessage, unavailable } from '../../common/domain-error';
import type { AppConfig } from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LLM_PROVIDER,
  LlmMessage,
  LlmProvider,
  StructuredRequest,
  StructuredResult,
} from './llm.types';
import { RESEARCH_LLM_PROMPTS, WRITER_LLM_PROMPTS } from '@youtube-ai-tool/shared';
import type { PromptName } from './prompt-names';

const RESEARCH = new Set<string>(RESEARCH_LLM_PROMPTS);
const WRITER = new Set<string>(WRITER_LLM_PROMPTS);

const MAX_TOOL_ROUNDS = 5;
const MAX_REPAIRS = 2;

function parseJson(content: string | null): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!content) return { ok: false, error: 'empty reply' };
  const body = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch (e) {
    return { ok: false, error: `not valid JSON (${errorMessage(e)})` };
  }
}

@Injectable()
export class LlmService {
  private readonly llm: AppConfig['llm'];

  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly prisma: PrismaService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.llm = config.get('llm', { infer: true });
  }

  /**
   * Runs one prompt to a validated JSON result. Tool calls (read-only DB access)
   * are executed in a loop; invalid output is sent back to the model with the
   * validation error. Every attempt is logged as a single LlmCall row.
   */
  async completeStructured<S extends z.ZodTypeAny>(req: StructuredRequest<S>): Promise<StructuredResult<z.output<S>>> {
    const model = await this.resolveModel(req.promptName, req.projectId);
    const user = typeof req.user === 'string' ? req.user : JSON.stringify(req.user, null, 1);
    const messages: LlmMessage[] = [
      { role: 'system', content: `${req.system}\n\nReply with a single JSON object only.` },
      { role: 'user', content: user },
    ];
    const toolsUsed = new Set<string>();
    let inputTokens = 0;
    let outputTokens = 0;
    let toolRounds = 0;
    let repairs = 0;
    let succeeded = false;

    try {
      for (;;) {
        const offerTools = req.tools && toolRounds < MAX_TOOL_ROUNDS;
        const res = await this.provider.chat({
          model,
          promptName: req.promptName,
          messages,
          tools: offerTools ? req.tools!.definitions : undefined,
        });
        inputTokens += res.inputTokens;
        outputTokens += res.outputTokens;

        if (offerTools && res.toolCalls.length) {
          toolRounds++;
          messages.push({ role: 'assistant', content: res.content, toolCalls: res.toolCalls });
          for (const call of res.toolCalls) {
            toolsUsed.add(call.name);
            const output = await req.tools!.execute(call).catch((e) => ({ error: errorMessage(e) }));
            messages.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify(output) });
          }
          continue;
        }

        const json = parseJson(res.content);
        const parsed = json.ok ? req.schema.safeParse(json.value) : null;
        if (parsed?.success) {
          succeeded = true;
          return { data: parsed.data, dbToolsUsed: [...toolsUsed] };
        }
        const problem = json.ok
          ? parsed!.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
          : json.error;
        if (repairs >= MAX_REPAIRS) {
          throw unavailable(`LLM returned invalid ${req.promptName} output: ${problem}`);
        }
        repairs++;
        messages.push(
          { role: 'assistant', content: res.content ?? '' },
          { role: 'user', content: `Your reply does not match the required JSON shape: ${problem}. Reply again with the corrected JSON only.` },
        );
      }
    } finally {
      await this.log(req.promptName, model, inputTokens, outputTokens, req.projectId ?? null, [...toolsUsed], succeeded);
    }
  }

  async embed(texts: string[], projectId: string | null = null): Promise<number[][]> {
    if (!texts.length) return [];
    const model = this.llm.embeddingModel;
    const res = await this.provider.embed(model, texts.map((t) => t.slice(0, 8000)));
    await this.log('embedding', model, res.inputTokens, 0, projectId, [], true);
    return res.vectors;
  }

  async embedOne(text: string, projectId: string | null = null): Promise<number[]> {
    const [v] = await this.embed([text], projectId);
    return v;
  }

  estimateResearchAnalysisCost(videoCount: number) {
    return estimateBasicAnalysisCost({
      videoCount,
      estInputTokensPerVideo: this.llm.estInputTokensPerVideo,
      estOutputTokensPerVideo: this.llm.estOutputTokensPerVideo,
      priceInputPer1M: this.llm.priceInputPer1M,
      priceOutputPer1M: this.llm.priceOutputPer1M,
    });
  }

  costUsd(inputTokens: number, outputTokens: number): number {
    const usd = (inputTokens / 1e6) * this.llm.priceInputPer1M + (outputTokens / 1e6) * this.llm.priceOutputPer1M;
    return Math.round(usd * 10000) / 10000;
  }

  researchDefaultModel(): string {
    return this.llm.models.research_queries;
  }

  writerDefaultModel(): string {
    return this.llm.models.writer;
  }

  private async resolveModel(promptName: PromptName, projectId?: string | null): Promise<string> {
    const fallback = this.llm.models[promptName];
    if (!projectId) return fallback;
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { llmResearchModel: true, llmWriterModel: true },
    });
    if (!project) return fallback;
    if (project.llmResearchModel && RESEARCH.has(promptName)) return project.llmResearchModel;
    if (project.llmWriterModel && WRITER.has(promptName)) return project.llmWriterModel;
    return fallback;
  }

  private async log(
    promptName: PromptName | 'embedding',
    model: string,
    inputTokens: number,
    outputTokens: number,
    projectId: string | null,
    dbToolsUsed: string[],
    succeeded: boolean,
  ) {
    await this.prisma.llmCall.create({
      data: { promptName, model, inputTokens, outputTokens, projectId, dbToolsUsed, succeeded },
    });
  }
}
