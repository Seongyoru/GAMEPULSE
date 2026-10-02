/**
 * Pre-paint MY GAMES state (server-safe module).
 *
 * The inline boot script copies the stored game selection onto <html data-mg="lol genshin">
 * before the first paint; the generated CSS hides cards of unselected games inside
 * [data-mg-scope] containers. Static/ISR HTML therefore looks personalized immediately — no
 * flash and no layout shift — and React takes over after hydration.
 */
import { listGames } from '@gamepulse/domain';

export const PREFERENCES_STORAGE_KEY = 'gamepulse:prefs:v1';

export const MY_GAMES_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  PREFERENCES_STORAGE_KEY,
)})||'null');var ids=p&&Array.isArray(p.selectedGameIds)?p.selectedGameIds.filter(function(x){return typeof x==='string'&&/^[a-z0-9-]{1,40}$/.test(x)}):[];if(ids.length){document.documentElement.setAttribute('data-mg',ids.join(' '))}}catch(e){}})();`;

export function myGamesCss(): string {
  return listGames()
    .map(
      (game) =>
        `html[data-mg]:not([data-mg~="${game.gameId}"]) [data-mg-scope] [data-mg-game="${game.gameId}"]{display:none!important}`,
    )
    .join('');
}
