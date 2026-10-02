/**
 * Pre-paint MY GAMES state (server-safe module).
 *
 * The inline boot script copies the stored game selection onto <html data-mg="lol genshin">
 * before the first paint; the generated CSS hides cards of unselected games inside
 * [data-mg-scope] containers. Static/ISR HTML therefore looks personalized immediately — no
 * flash and no layout shift — and React takes over after hydration.
 */
import { listPublicGames } from '@gamepulse/domain';

export const PREFERENCES_STORAGE_KEY = 'gamepulse:prefs:v1';

// Only ids of games shown on the site reach the attribute: a stored selection of hidden games must
// not hide every card before hydration (the app then falls back to the anonymous defaults).
const PUBLIC_GAME_IDS = JSON.stringify(listPublicGames().map((game) => game.gameId));

export const MY_GAMES_BOOT_SCRIPT = `(function(){try{var k=${PUBLIC_GAME_IDS};var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  PREFERENCES_STORAGE_KEY,
)})||'null');var ids=p&&Array.isArray(p.selectedGameIds)?p.selectedGameIds.filter(function(x){return typeof x==='string'&&k.indexOf(x)>=0}):[];if(ids.length){document.documentElement.setAttribute('data-mg',ids.join(' '))}}catch(e){}})();`;

export function myGamesCss(): string {
  return listPublicGames()
    .map(
      (game) =>
        `html[data-mg]:not([data-mg~="${game.gameId}"]) [data-mg-scope] [data-mg-game="${game.gameId}"]{display:none!important}`,
    )
    .join('');
}
