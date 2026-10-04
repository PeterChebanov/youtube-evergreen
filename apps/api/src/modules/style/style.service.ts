import { Injectable } from '@nestjs/common';
import { channelStyleDraftSchema, type ChannelStyleRequest } from '@youtube-ai-tool/shared';
import { conflict } from '../../common/domain-error';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { PromptComposer } from '../prompts/prompt-composer.service';

/** Our own channel voice, versioned on every save (REQUIREMENTS 1.10–1.11). */
@Injectable()
export class StyleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly composer: PromptComposer,
  ) {}

  latest() {
    return this.prisma.channelStyle.findFirst({ orderBy: { version: 'desc' } });
  }

  history() {
    return this.prisma.channelStyle.findMany({ orderBy: { version: 'desc' } });
  }

  async save(input: ChannelStyleRequest) {
    const last = await this.latest();
    return this.prisma.channelStyle.create({ data: { ...input, version: (last?.version ?? 0) + 1 } });
  }

  /** Synthesises a voice from the strongest techniques of several authors, never a copy of one. */
  async draftFromAuthors() {
    const styles = await this.prisma.authorStyle.findMany({
      include: { channel: { select: { channelName: true } } },
      orderBy: [{ channelId: 'asc' }, { order: 'asc' }],
    });
    if (!styles.length) throw conflict('Research at least one channel before drafting the channel style');
    const current = await this.latest();
    const { data } = await this.llm.completeStructured({
      promptName: 'channel_style',
      system: await this.composer.single('channel_style'),
      user: {
        currentStyle: current && { voice: current.voice, themes: current.themes, techniques: current.techniques, retentionRules: current.retentionRules },
        authorStyles: styles.map((s) => ({ id: s.id, channel: s.channel.channelName, technique: s.technique, description: s.description })),
      },
      schema: channelStyleDraftSchema,
    });
    return this.save({
      voice: data.voice,
      themes: data.themes,
      retentionRules: data.retentionRules,
      techniques: data.techniques.map((t) => ({ name: t.name, description: t.description })),
    });
  }

  /** True when channels were researched after the last style version (REQUIREMENTS 1.11). */
  async updateSuggested(): Promise<boolean> {
    const [style, channel] = await Promise.all([
      this.latest(),
      this.prisma.channel.findFirst({ where: { lastResearchedAt: { not: null } }, orderBy: { lastResearchedAt: 'desc' } }),
    ]);
    if (!channel?.lastResearchedAt) return false;
    return !style || channel.lastResearchedAt > style.createdAt;
  }
}
