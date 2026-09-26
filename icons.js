const paths={
  menu:'M4 7h16M4 12h16M4 17h16',
  bell:'M18 8a6 6 0 0 0-12 0c0 7-2 8-2 8h16s-2-1-2-8M10 20h4',
  accounts:'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 4h10v3H7V7Zm1 7h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01',
  inventory:'m12 2 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V7M12 12v10',
  partners:'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2h14Zm-7-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 9v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  reports:'M4 20V11M10 20V4M16 20v-8M22 20v-5',
  cashier:'M4 8h16v12H4V8Zm2-4h12M7 12h4m3 0h3M7 16h10',
  close:'M5 5l14 14M19 5 5 19'
};
export function icon(name,size=24){return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.accounts}"/></svg>`;}
