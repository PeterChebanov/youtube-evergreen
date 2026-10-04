import { htmlToText } from './html-text';

describe('htmlToText', () => {
  it('extracts title and paragraphs, dropping scripts, styles and navigation', () => {
    const html = `<html><head><title>Pripyat &amp; Chernobyl</title><style>p{color:red}</style></head>
      <body><nav>Home | About</nav><script>track()</script>
      <h1>The evacuation</h1><p>On 27 April 1986 the city was   evacuated.</p>
      <p>About 49,000 people left in <b>three hours</b>.</p><footer>© site</footer></body></html>`;
    expect(htmlToText(html)).toEqual({
      title: 'Pripyat & Chernobyl',
      text: 'The evacuation\nOn 27 April 1986 the city was evacuated.\nAbout 49,000 people left in three hours .',
    });
  });

  it('decodes numeric entities', () => {
    expect(htmlToText('<p>&#171;quote&#187; &#x2014; ok</p>').text).toBe('«quote» — ok');
  });

  it('copes with a page without a title', () => {
    expect(htmlToText('<p>text</p>').title).toBeNull();
  });
});
