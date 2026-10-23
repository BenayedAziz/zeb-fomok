'use client';
import { useStore } from '@/lib/store';
import type { Settings } from '@/lib/types';

type Theme = NonNullable<Settings['theme']>;

/** Mini carte d'aperçu : une tâche, avec ou sans personnage, dans le thème donné. */
function Preview({ mascot, theme }: { mascot: boolean; theme?: 'light' | 'dark' }) {
  return (
    <span className={`sp-preview${theme ? ` t-${theme}` : ''}`} aria-hidden="true">
      <span className="sp-card">
        <i className="sp-ck" />
        <span className="sp-lines">
          <b />
          <span>
            <em />
            <em />
          </span>
        </span>
        {mascot && <img src="/mascots/idee.webp" alt="" width={34} height={34} />}
      </span>
    </span>
  );
}

/** Avec ou sans les personnages nuages. */
export function MascotChoice() {
  const store = useStore();
  const on = store.data.settings.showMascots !== false;
  const opts: [boolean, string, string][] = [
    [true, 'Avec les nuages', 'Un petit personnage illustre chaque tâche.'],
    [false, 'Sans, plus sobre', 'Des cartes épurées, pour un usage pro.'],
  ];
  return (
    <div className="sp-grid two" role="radiogroup" aria-label="Personnages">
      {opts.map(([v, t, d]) => (
        <button key={t} role="radio" aria-checked={on === v} className={`sp-opt${on === v ? ' on' : ''}`} onClick={() => store.setSettings({ showMascots: v })}>
          <Preview mascot={v} />
          <b>{t}</b>
          <span>{d}</span>
          {v && (
            <span className="sp-faces" aria-hidden="true">
              {['course', 'cuisine', 'reunion', 'plage'].map((m) => (
                <img key={m} src={`/mascots/${m}.webp`} alt="" width={28} height={28} />
              ))}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Clair, sombre, ou comme l'appareil : s'applique tout de suite. */
export function ThemeChoice() {
  const store = useStore();
  const cur: Theme = store.data.settings.theme || 'auto';
  const mascot = store.data.settings.showMascots !== false;
  const opts: [Theme, string, string][] = [
    ['light', 'Clair', 'Ciel de jour.'],
    ['dark', 'Sombre', 'Ciel de nuit, plus doux le soir.'],
    ['auto', 'Comme mon appareil', 'Suit le réglage de ton téléphone ou ordinateur.'],
  ];
  return (
    <div className="sp-grid three" role="radiogroup" aria-label="Apparence">
      {opts.map(([v, t, d]) => (
        <button key={v} role="radio" aria-checked={cur === v} className={`sp-opt${cur === v ? ' on' : ''}`} onClick={() => store.setSettings({ theme: v })}>
          {v === 'auto' ? (
            <span className="sp-split" aria-hidden="true">
              <Preview mascot={mascot} theme="light" />
              <Preview mascot={mascot} theme="dark" />
            </span>
          ) : (
            <Preview mascot={mascot} theme={v} />
          )}
          <b>{t}</b>
          <span>{d}</span>
        </button>
      ))}
    </div>
  );
}
