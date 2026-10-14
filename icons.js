const paths={
  edit:'m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5M4 15l5 5',
  info:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 7h.01',
  search:'M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  scan:'M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3M7 7v10M10 7v10M14 7v10M17 7v10',
  plus:'M12 3v18M3 12h18',
  filter:'M3 4h18l-7 8v6l-4 3v-9L3 4Z',
  calendar:'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2ZM7 2v5M17 2v5M3 10h18M8 14h2M14 14h2M8 17h2',
  menu:'M4 7h16M4 12h16M4 17h16',
  bell:'M18 8a6 6 0 0 0-12 0c0 7-2 8-2 8h16s-2-1-2-8M10 20h4',
  accounts:'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 4h10v3H7V7Zm1 7h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01',
  inventory:'m12 2 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V7M12 12v10',
  partners:'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2h14Zm-7-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 9v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  reports:'M4 20V11M10 20V4M16 20v-8M22 20v-5',
  cashier:'M5 9h14a3 3 0 0 1 3 3v8H2v-8a3 3 0 0 1 3-3Zm2 0V4h10l2 5M6 13h2m3 0h2m3 0h2M6 17h12',
  close:'M5 5l14 14M19 5 5 19'
};
export function icon(name,size=24){return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.accounts}"/></svg>`;}
