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
    {
      type: 'container',
      title: 'Controls (interactive)',
      layout: 'stack',
      children: [
        { type: 'input', label: 'Projektname', value: 'Omadia', placeholder: 'Name eingeben' },
        { type: 'toggle', label: 'Benachrichtigungen', value: true, variant: 'switch' },
        {
          type: 'choice',
          label: 'Umgebung',
          variant: 'radio',
          value: 'staging',
          options: [
            { value: 'staging', label: 'Staging' },
            { value: 'production', label: 'Production' },
          ],
        },
        {
          type: 'choice',
          label: 'Region (dropdown)',
          variant: 'dropdown',
          options: [
            { value: 'eu', label: 'EU (Frankfurt)' },
            { value: 'us', label: 'US (Virginia)' },
          ],
        },
      ],
    },
    {
      type: 'container',
      title: 'Progress & image',
      layout: 'stack',
      children: [
        { type: 'progress', value: 0.65, indeterminate: false },
        { type: 'progress', indeterminate: true },
        {
          type: 'image',
          src: 'https://omadia.ai/assets/sample.png',
          altText: 'Beispielbild — Fallback, falls offline',
        },
      ],
    },
    {
      type: 'form',
      title: 'Projekt anlegen (form)',
      children: [
        { type: 'input', label: 'Name', placeholder: 'Projektname' },
        { type: 'button', label: 'Anlegen' },
      ],
    },
    {
      type: 'container',
      title: 'Menubar & tree',
      layout: 'stack',
      children: [
        { type: 'menubar', items: [{ label: 'Datei' }, { label: 'Bearbeiten' }, { label: 'Ansicht' }] },
        {
          type: 'tree',
          nodes: [
            {
              itemKey: 'root',
              label: 'Ebenen',
              children: [
                { itemKey: 'bg', label: 'Hintergrund' },
                {
                  itemKey: 'fg',
                  label: 'Vordergrund',
                  children: [{ itemKey: 'fg-1', label: 'Form 1' }],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'container',
      title: 'Charts',
      layout: 'stack',
      children: [
        {
          type: 'chart',
          chartType: 'bar',
          points: [
            { pointKey: 'q1', label: 'Q1', value: 1200 },
            { pointKey: 'q2', label: 'Q2', value: 1450 },
            { pointKey: 'q3', label: 'Q3', value: 1380 },
          ],
        },
        {
          type: 'chart',
          chartType: 'line',
          points: [
            { pointKey: 'jan', label: 'Jan', value: 40 },
            { pointKey: 'feb', label: 'Feb', value: 72 },
            { pointKey: 'mar', label: 'Mär', value: 58 },
            { pointKey: 'apr', label: 'Apr', value: 96 },
          ],
        },
        {
          type: 'chart',
          chartType: 'pie',
          points: [
            { pointKey: 'a', label: 'Organic', value: 60 },
            { pointKey: 'b', label: 'Paid', value: 25 },
            { pointKey: 'c', label: 'Referral', value: 15 },
          ],
        },
      ],
    },
    {
      type: 'container',
      title: 'Editor primitives (shells)',
      layout: 'stack',
      children: [
        {
          type: 'timeline',
          tracks: [
            { id: 'v1', kind: 'video' },
            { id: 'a1', kind: 'audio' },
          ],
          duration: 12000,
          playhead: 4000,
        },
        {
          type: 'vector-path',
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 40 },
            { x: 160, y: 120 },
            { x: 40, y: 160 },
          ],
          closed: true,
        },
        { type: 'media', mediaType: 'video', duration: 12000 },
        { type: 'canvas-region', width: 1920, height: 1080 },
      ],
    },
    { type: 'divider' },
    { type: 'text', content: 'Ende der Galerie.' },
  ],
};
