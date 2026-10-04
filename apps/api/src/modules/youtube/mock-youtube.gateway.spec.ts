import { MockYoutubeGateway } from './mock-youtube.gateway';

describe('MockYoutubeGateway', () => {
  it('pages through distinct uploads of one channel', async () => {
    const gw = new MockYoutubeGateway();
    const channel = await gw.resolveChannel({ kind: 'handle', value: 'history-lab' });
    const ids: string[] = [];
    let token: string | null = null;
    do {
      const page = await gw.listUploads(channel.uploadsPlaylistId!, token);
      ids.push(...page.videoIds);
      token = page.nextPageToken;
    } while (token);

    expect(ids).toHaveLength(channel.videoCount);
    expect(new Set(ids).size).toBe(ids.length);
    const videos = await gw.getVideos(ids);
    expect(new Set(videos.map((v) => v.title)).size).toBe(ids.length);
  });

  it('gives different channels different videos', async () => {
    const gw = new MockYoutubeGateway();
    const a = await gw.resolveChannel({ kind: 'handle', value: 'a' });
    const b = await gw.resolveChannel({ kind: 'handle', value: 'b' });
    const [pa, pb] = await Promise.all([gw.listUploads(a.uploadsPlaylistId!, null), gw.listUploads(b.uploadsPlaylistId!, null)]);
    expect(pa.videoIds.filter((id) => pb.videoIds.includes(id))).toEqual([]);
  });
});
