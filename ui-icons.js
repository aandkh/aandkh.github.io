// Static, original interface artwork; no data or venue imagery is generated.
const paths={
 layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
 bookmark:'<path d="M6 4h12v17l-6-4-6 4V4Z"/>',
 route:'<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M9 6h7a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 locate:'<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5M5.2 7a8 8 0 0 1 13.3-1L20 8M4 16l1.5 2A8 8 0 0 0 18.8 17"/>',
 reset:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
 share:'<path d="M14 3h7v7m0-7L10 14M10 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5"/>',
 results:'<path d="M9 5h12M9 12h12M9 19h12M3 5h.1M3 12h.1M3 19h.1"/>',
 conditions:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
 goout:'<path d="M5 3h14l-7 9-7-9Zm7 9v9m-4 0h8"/>',
 explore:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>'
};
export function uiIcon(name){return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(paths[name]||paths.info)+'</svg>';}
