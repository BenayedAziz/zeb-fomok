'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Settings } from '@/lib/types';
import { useUI } from '../ui-context';
import { Icon } from '../icons';
import { Head } from './Calendar';
import { DEFAULT_CONTEXTS, REVIEW_CADENCES, ctxLabel } from '@/lib/gtd';

const PRESETS: { key: string; name: string; text: string; s: Partial<Settings> }[] = [
  {
    key: 'simple',
    name: 'Simple',
    text: 'Des tâches, des projets, un agenda. Pas de contextes ni de priorités.',
    s: { showContexts: false, showPriorities: false, showWaitingSomeday: false, reviewEvery: 7 },
  },
  {
    key: 'gtd',
    name: 'GTD complet',
    text: 'Contextes, priorités, listes « En attente » et « Un jour », revue chaque semaine.',
    s: { showContexts: true, showPriorities: true, showWaitingSomeday: true, reviewEvery: 7 },
  },
];

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle-row">
      <span>
        <b>{label}</b>
        {hint && <span className="hint">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={on} className={`switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
        <i />
      </button>
    </label>
  );
}

export function SettingsView() {
  const store = useStore();
  const s = store.data.settings;
  const { toast, set } = useUI();
  const [ctx, setCtx] = useState('');
  const save = (p: Partial<Settings>) => store.setSettings(p);
  const active = PRESETS.find((p) => Object.entries(p.s).every(([k, v]) => s[k as keyof Settings] === v))?.key;
  const addCtx = (e: React.FormEvent) => {
    e.preventDefault();
    let v = ctx.trim().toLowerCase().replace(/\s+/g, '-');
    if (!v) return;
    if (!v.startsWith('@')) v = `@${v}`;
    if (s.contexts.includes(v)) return toast({ text: 'Ce contexte existe déjà.' });
    save({ contexts: [...s.contexts, v] });
    setCtx('');
  };
  const hours = Array.from({ length: 25 }, (_, h) => h);
  return (
    <>
      <Head eyebrow="Réglages" title="Ton appli, à ta façon" lede="Garde seulement ce qui t'aide. Tout se change à tout moment, rien n'est perdu." />
      <div className="stack">
        <div className="sec">
          <div className="sec-head">
            <h2>Point de départ</h2>
          </div>
          <div className="presets">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                className={`preset${active === p.key ? ' on' : ''}`}
                onClick={() => {
                  save(p.s);
                  toast({ text: `Mode ${p.name} activé` });
                }}
              >
                <b>{p.name}</b>
                <span>{p.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sec">
          <div className="sec-head">
            <h2>Ce que tu vois sur les cartes</h2>
          </div>
          <div className="toggles">
            <Toggle on={s.showContexts} onChange={(v) => save({ showContexts: v })} label="Contextes" hint="Où tu peux faire l'action : @ordi, @téléphone…" />
            <Toggle on={s.showPriorities} onChange={(v) => save({ showPriorities: v })} label="Priorités" hint="Haute, moyenne, basse." />
            <Toggle on={s.showWaitingSomeday} onChange={(v) => save({ showWaitingSomeday: v })} label="Listes « En attente » et « Un jour »" hint="Ce que tu as délégué, et les idées pour plus tard." />
          </div>
        </div>

        {s.showContexts && (
          <div className="sec">
            <div className="sec-head">
              <h2>Tes contextes</h2>
              <button className="btn ghost sm" onClick={() => save({ contexts: DEFAULT_CONTEXTS })}>
                Revenir aux contextes de base
              </button>
            </div>
            <div className="pick">
              {s.contexts.map((c) => (
                <span className="tag" key={c}>
                  {ctxLabel(c)}
                  <button
                    onClick={() => s.contexts.length > 1 && save({ contexts: s.contexts.filter((x) => x !== c) })}
                    aria-label={`Retirer ${c}`}
                    disabled={s.contexts.length <= 1}
                  >
                    <Icon name="x" />
                  </button>
                </span>
              ))}
            </div>
            <form className="addrow" onSubmit={addCtx} style={{ marginTop: 10 }}>
              <input className="inp" value={ctx} onChange={(e) => setCtx(e.target.value)} placeholder="Nouveau contexte, ex. @voiture, @salle, @studio" aria-label="Nouveau contexte" />
              <button className="btn" type="submit">
                Ajouter
              </button>
            </form>
          </div>
        )}

        <div className="sec">
          <div className="sec-head">
            <h2>Agenda</h2>
          </div>
          <div className="row3">
            <label className="fld">
              <span>Vue au démarrage</span>
              <select
                className="inp"
                value={s.defaultCal}
                onChange={(e) => {
                  save({ defaultCal: e.target.value as Settings['defaultCal'] });
                  set({ cal: e.target.value as Settings['defaultCal'] });
                }}
              >
                <option value="day">Ma journée</option>
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
              </select>
            </label>
            <label className="fld">
              <span>Début de journée</span>
              <select className="inp" value={s.dayStart} onChange={(e) => save({ dayStart: Math.min(Number(e.target.value), s.dayEnd - 1) })}>
                {hours.slice(0, 24).map((h) => (
                  <option key={h} value={h}>
                    {h} h
                  </option>
                ))}
              </select>
            </label>
            <label className="fld">
              <span>Fin de journée</span>
              <select className="inp" value={s.dayEnd} onChange={(e) => save({ dayEnd: Math.max(Number(e.target.value), s.dayStart + 1) })}>
                {hours.slice(1).map((h) => (
                  <option key={h} value={h}>
                    {h} h
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="sec">
          <div className="sec-head">
            <h2>Revue</h2>
          </div>
          <p className="hint" style={{ marginTop: 0 }}>
            Le moment où tu vides ta tête, vérifies tes projets et prépares la suite. Courte si elle est fréquente, plus complète si elle est espacée.
          </p>
          <div className="pick">
            {REVIEW_CADENCES.map(([n, l]) => (
              <button key={n} className={s.reviewEvery === n ? 'on' : ''} onClick={() => save({ reviewEvery: n })}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
