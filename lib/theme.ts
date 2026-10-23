import type { Settings } from './types';

export type Theme = NonNullable<Settings['theme']>;
export const THEME_KEY = 'sc-theme';

/** Script lancé avant l'affichage : évite un éclair de clair quand on a choisi le sombre (et l'inverse). */
export const THEME_BOOT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

/** Applique le thème choisi et le garde sur l'appareil pour le prochain chargement. */
export function applyTheme(t: Theme | undefined) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t;
  else delete root.dataset.theme;
  try {
    localStorage.setItem(THEME_KEY, t || 'auto');
  } catch {
    /* stockage indisponible : le thème vaut pour cette visite */
  }
}
