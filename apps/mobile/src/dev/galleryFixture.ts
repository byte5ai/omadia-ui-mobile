/** DEV-only fixture: realistic instances of the rendered primitives, ordered so
 *  the top viewport shows the tone-bearing modules (status chips, toned list).
 *  Not shipped. */
export const galleryTree = {
  type: 'container',
  title: 'Primitive Gallery',
  layout: 'stack',
  children: [
    {
      type: 'container',
      title: 'Status (tone)',
      layout: 'stack',
      children: [
        { type: 'heading', content: 'SEO-Score', level: 3 },
        { type: 'text', content: '70 / 100 (C)' },
        { type: 'status', text: 'PASS · indexierbar', tone: 'success' },
        { type: 'status', text: 'WARN · 3 Meta-Descriptions fehlen', tone: 'warning' },
        { type: 'status', text: 'FAIL · kein HTTPS-Redirect', tone: 'danger' },
        { type: 'status', text: 'INFO · Sitemap gefunden', tone: 'info' },
        { type: 'status', text: 'NEUTRAL · ohne tone (blass)' },
      ],
    },
    {
      type: 'pane',
      title: 'Liste (tone)',
      children: [
        { type: 'list', items: [
          { itemKey: 'a', label: 'Neutrales Listenelement' },
          { itemKey: 'b', label: 'Erfolg: Seite geladen', tone: 'success' },
          { itemKey: 'c', label: 'Fehler: 404 gefunden', tone: 'danger' },
        ] },
      ],
    },
    {
      type: 'toolbar',
      children: [
        { type: 'button', label: 'Re-Scan' },
        { type: 'button', label: 'Export CSV' },
        { type: 'button', label: 'Teilen' },
      ],
    },
    {
      type: 'container',
      title: 'Data table',
      layout: 'stack',
      children: [
        {
          type: 'table',
          columns: [
            { fieldKey: 'url', label: 'URL' },
            { fieldKey: 'status', label: 'Status' },
            { fieldKey: 'title', label: 'Title' },
            { fieldKey: 'words', label: 'Words' },
          ],
          rows: [
            { rowKey: '1', cells: { url: '/', status: '200', title: 'Home — omadia.ai', words: '812' } },
            { rowKey: '2', cells: { url: '/pricing', status: '200', title: 'Pricing', words: '430' } },
            { rowKey: '3', cells: { url: '/blog/launch', status: '301', title: 'Launch post', words: '1290' } },
          ],
        },
      ],
    },
    {
      type: 'tabs',
      activeStep: 0,
      tabs: [
        { label: 'Übersicht', child: { type: 'text', content: 'Tab 1 — overview prose.' } },
        { label: 'Performance', child: { type: 'text', content: 'Tab 2 — performance details.' } },
        { label: 'Backlinks', child: { type: 'text', content: 'Tab 3 — backlink profile.' } },
      ],
    },
    { type: 'divider' },
    { type: 'text', content: 'Ende der Galerie.' },
  ],
};
