import { videoUrl } from '@youtube-ai-tool/shared';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unavailable } from '../../common/domain-error';
import type { AppConfig } from '../../config/app.config';
import { RetryableError, SerialThrottle, withBackoff } from './throttle';
import { vttToText } from './vtt';

/** Returns the transcript text, or null when the video has no subtitles. */
export interface SubtitleProvider {
  fetch(youtubeVideoId: string): Promise<string | null>;
}

export const SUBTITLE_PROVIDER = Symbol('SUBTITLE_PROVIDER');

export class YtDlpSubtitleProvider implements SubtitleProvider {
  private readonly throttle: SerialThrottle;

  constructor(private readonly cfg: AppConfig['subtitles']) {
    this.throttle = new SerialThrottle(cfg.delayMs);
  }

  fetch(youtubeVideoId: string): Promise<string | null> {
    return this.throttle.run(() => withBackoff(() => this.download(youtubeVideoId), this.cfg.maxRetries, this.cfg.delayMs * 2));
  }

  private async download(youtubeVideoId: string): Promise<string | null> {
    const dir = await mkdtemp(join(tmpdir(), 'subs-'));
    try {
      const args = [
        '--skip-download',
        '--write-subs',
        '--write-auto-subs',
        '--sub-langs', this.cfg.langs.join(','),
        '--sub-format', 'vtt',
        '--no-progress',
        '--no-playlist',
        '-o', join(dir, '%(id)s.%(ext)s'),
        ...(this.cfg.proxy ? ['--proxy', this.cfg.proxy] : []),
        ...(this.cfg.cookiesFile ? ['--cookies', this.cfg.cookiesFile] : []),
        videoUrl(youtubeVideoId),
      ];
      await this.run(args);
      const files = (await readdir(dir)).filter((f) => f.endsWith('.vtt'));
      const preferred = this.cfg.langs.map((l) => files.find((f) => f.endsWith(`.${l}.vtt`))).find(Boolean) ?? files[0];
      if (!preferred) return null;
      const text = vttToText(await readFile(join(dir, preferred), 'utf8'));
      return text || null;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.cfg.ytdlpPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (d) => (stderr += d));
      child.on('error', (e: NodeJS.ErrnoException) =>
        reject(e.code === 'ENOENT' ? unavailable(`yt-dlp not found at "${this.cfg.ytdlpPath}"; install it or set YTDLP_PATH`) : e),
      );
      child.on('close', (code) => {
        if (code === 0) return resolve();
        const message = stderr.trim().split('\n').at(-1) ?? `yt-dlp exited with ${code}`;
        if (/429|Too Many Requests|rate.?limit/i.test(stderr)) return reject(new RetryableError(message));
        reject(unavailable(`yt-dlp failed: ${message}`));
      });
    });
  }
}

/** Offline provider: deterministic subtitles for every video except ids starting with "x". */
export class MockSubtitleProvider implements SubtitleProvider {
  async fetch(youtubeVideoId: string): Promise<string | null> {
    if (youtubeVideoId.startsWith('x')) return null;
    return [
      'Imagine you wake up and the city around you is empty.',
      'Remember this, it matters later.',
      'But here is the strange part: nobody wrote down why.',
      `Video ${youtubeVideoId} keeps that question open until the very end.`,
    ].join('\n');
  }
}
