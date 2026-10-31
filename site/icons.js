// Shared 24 px outline icons. Each control keeps its existing accessible label.
const paths={
 back:'<path d="m14 5-7 7 7 7"/>',next:'<path d="m10 5 7 7-7 7"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',
 more:'<g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></g>',
 play:'<path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
 start:'<path d="M6 5v14M18 5 8 12l10 7Z"/>',
 pause:'<path d="M8 6v12M16 6v12" stroke-width="3.2"/>',
 undo:'<path d="m8 5-5 5 5 5M3 10h10a6 6 0 0 1 6 6v2"/>',
 redo:'<path d="m16 5 5 5-5 5m5-5H11a6 6 0 0 0-6 6v2"/>',
 pencil:'<path d="m15.5 4.5 4 4M4 16l12-12a1.5 1.5 0 0 1 2 0l2 2a1.5 1.5 0 0 1 0 2L8 20H4Z"/>',
 eraser:'<path d="m14 4 6 6a1.5 1.5 0 0 1 0 2l-8 8H7l-4-4a1.5 1.5 0 0 1 0-2L12 4a1.5 1.5 0 0 1 2 0ZM7 11l7 7M12 20h8"/>',
 chevron:'<path d="m7 10 5 5 5-5"/>',
 metronome:'<path d="M9 4h6l5 16H4ZM12 16l6-11M8 16h8"/>'
};
export function icon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[name]||''}</svg>`;}
