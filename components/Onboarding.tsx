'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore, uuid } from '@/lib/store';
import type { Horizon } from '@/lib/types';
import { useUI } from './ui-context';
import { ImportPanel } from './Import';
import { MascotChoice, ThemeChoice } from './StylePicker';
import { COLORS, DOMAIN_SUGGESTIONS, HORIZONS } from '@/lib/gtd';
import { todayIso } from '@/lib/dates';

type Msg = { role: 'user' | 'assistant'; content: string };
type Step = 'welcome' | 'style' | 'interview' | 'recap' | 'manual' | 'tools' | 'first';

const opening = (name: string | null) =>
  `Salut${name ? ` ${name}` : ''} ! Je vais te poser quelques questions pour préparer ton espace : tes domaines de vie, tes objectifs et tes projets en cours. Ça prend 5 minutes, et tu pourras tout modifier ensuite.\n\nPour commencer : qu'est-ce qui occupe ta vie en ce moment ? Ton travail, tes projets à côté, le perso.`;

/* Exemples pour la première capture : on voit tout de suite ce que fait l'IA. */
const FIRST_EXAMPLES = [
  'Dentiste jeudi 10h et rappeler maman ce soir',
  'Réserver un resto pour samedi soir avec Sarah',
  'Faut que je renouvelle mon passeport avant l’été',
];

interface Summary {
  domains: { name: string; on: boolean }[];
  goals: { title: string; horizon: Horizon; on: boolean }[];
  projects: { name: string; domain: string | null; outcome: string | null; goal: string | null; nextAction: string | null; on: boolean }[];
}

export const ONB_KEY = 'sc-onboarding-done';

function StepsBar({ step }: { step: Step }) {
  const order: [Step[], string][] = [
    [['welcome'], 'Bienvenue'],
    [['style'], 'Ton style'],
    [['interview', 'manual'], 'Entretien'],
    [['recap'], 'Récap'],
    [['tools'], 'Tes outils'],
    [['first'], 'Premier essai'],
  ];
  const idx = order.findIndex(([s]) => s.includes(step));
  return (
    <div className="steps-bar">
      {order.map(([, l], i) => (
        <span key={l} className={i === idx ? 'on' : i < idx ? 'done' : ''}>
          {l}
        </span>
      ))}
    </div>
  );
}

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const store = useStore();
  const { toast, capture } = useUI();
  const [step, setStep] = useState<Step>('welcome');
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ role: 'assistant', content: opening(store.name) }]);
  const [first, setFirst] = useState('');
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [about, setAbout] = useState('');
  const [manualDomains, setManualDomains] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const userTurns = msgs.filter((m) => m.role === 'user').length;

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, thinking]);

  const send = async () => {
    const t = draft.trim();
    if (!t || thinking) return;
    const next: Msg[] = [...msgs, { role: 'user', content: t }];
    setMsgs(next);
    setDraft('');
    setThinking(true);
    setError(null);
    try {
      const res = await fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'chat', messages: next }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.error === 'ai_not_configured') {
          setError("L'IA n'est pas encore branchée sur ce site : on passe à la version rapide.");
          setStep('manual');
        } else setError(body.error === 'daily_limit' ? 'Limite IA du jour atteinte.' : "L'IA n'a pas répondu. Renvoie ton message.");
        return;
      }
      setMsgs([...next, { role: 'assistant', content: body.reply }]);
    } catch {
      setError('Pas de connexion.');
    } finally {
      setThinking(false);
    }
  };

  const recap = async () => {
    setThinking(true);
    setError(null);
    try {
      const res = await fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'summary', messages: msgs, today: todayIso() }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.summary) {
        setError("Le récap n'a pas pu être préparé. Réessaie.");
        return;
      }
      const s = body.summary as { domains?: { name?: string }[]; goals?: { title?: string; horizon?: string }[]; projects?: { name?: string; domain?: string; outcome?: string; goal?: string; nextAction?: string }[] };
      setAbout(typeof (body.summary as { about?: unknown }).about === 'string' ? ((body.summary as { about: string }).about || '').slice(0, 2000) : '');
      setSummary({
        domains: (s.domains || []).filter((d) => d?.name).map((d) => ({ name: d.name!.slice(0, 60), on: true })),
        goals: (s.goals || []).filter((g) => g?.title).map((g) => ({ title: g.title!.slice(0, 200), horizon: (['vision', 'year', 'behavior'].includes(g.horizon || '') ? g.horizon : 'year') as Horizon, on: true })),
        projects: (s.projects || []).filter((p) => p?.name).map((p) => ({ name: p.name!.slice(0, 120), domain: p.domain || null, outcome: p.outcome || null, goal: p.goal || null, nextAction: p.nextAction || null, on: true })),
      });
      setStep('recap');
    } catch {
      setError('Pas de connexion.');
    } finally {
      setThinking(false);
    }
  };

  const createFromSummary = () => {
    if (!summary) return;
    const domIds: Record<string, string> = {};
    const goalIds: Record<string, string> = {};
    const domains = summary.domains
      .filter((d) => d.on)
      .map((d, i) => {
        const id = uuid();
        domIds[d.name.toLowerCase()] = id;
        return { id, name: d.name, color: COLORS[i % COLORS.length], position: i };
      });
    const goals = summary.goals
      .filter((g) => g.on)
      .map((g) => {
        const id = uuid();
        goalIds[g.title.toLowerCase()] = id;
        return { id, title: g.title, horizon: g.horizon };
      });
    const projects: { id: string; name: string; domainId: string | null; goalId: string | null; outcome: string | null }[] = [];
    const items: { title: string; status: 'todo'; projectId: string; domainId: string | null }[] = [];
    summary.projects
      .filter((p) => p.on)
      .forEach((p) => {
        const id = uuid();
        const domainId = p.domain ? domIds[p.domain.toLowerCase()] || null : null;
        projects.push({ id, name: p.name, domainId, goalId: p.goal ? goalIds[p.goal.toLowerCase()] || null : null, outcome: p.outcome });
        if (p.nextAction) items.push({ title: p.nextAction, status: 'todo', projectId: id, domainId });
      });
    store.bulk({ domains, goals, projects, items });
    if (about.trim()) store.setSettings({ about: [store.get().settings.about, about.trim()].filter(Boolean).join('\n') });
    setStep('tools');
  };

  const createManual = () => {
    store.bulk({ domains: manualDomains.map((name, i) => ({ name, color: COLORS[i % COLORS.length], position: i })) });
    setStep('tools');
  };

  const finish = () => {
    try {
      localStorage.setItem(ONB_KEY, '1');
    } catch {
      /* ignore */
    }
    onFinish();
  };

  /* Première capture : l'IA range pendant qu'on arrive sur la journée, la notification montre le résultat. */
  const tryFirst = (text: string) => {
    const t = text.trim();
    if (!t) return;
    finish();
    void capture(t);
  };

  return (
    <div className="onb">
      <StepsBar step={step} />

      {step === 'welcome' && (
        <>
          <div>
            <div className="eyebrow">Bienvenue{store.name ? ` ${store.name}` : ''}</div>
            <h1>
              Ton <em>second cerveau</em>, prêt en 5 minutes.
            </h1>
            <p className="lede">
              Tu notes tout ce qui te passe par la tête, l&apos;IA le range dans le bon projet, et tu retrouves ta journée, ta semaine et ton mois au même endroit. C&apos;est la méthode Getting Things Done, sans la paperasse.
            </p>
          </div>
          <div className="tools">
            <div className="tool">
              <b>1. Un entretien de 5 minutes</b>
              <p>L&apos;IA te pose quelques questions sur tes objectifs et tes projets pour préparer ton espace.</p>
            </div>
            <div className="tool">
              <b>2. Tu valides le récap</b>
              <p>Domaines de vie, objectifs, projets : tu gardes ce qui est juste.</p>
            </div>
            <div className="tool">
              <b>3. Tu connectes tes outils</b>
              <p>Notion, Gmail, Outlook, ton calendrier : l&apos;IA en extrait tes projets en cours.</p>
            </div>
          </div>
          <div className="vh-actions">
            <button className="btn primary lg" onClick={() => setStep('style')}>
              C&apos;est parti
            </button>
          </div>
        </>
      )}

      {step === 'style' && (
        <>
          <div>
            <div className="eyebrow">Ton style</div>
            <h1>
              Ton espace, <em>à ton goût</em>.
            </h1>
            <p className="lede">Choisis comment ça s&apos;affiche. Tu vois le résultat tout de suite, et tu peux changer d&apos;avis plus tard dans les Réglages.</p>
          </div>
          <div className="onb-style">
            <section>
              <h2>Les personnages nuages</h2>
              <MascotChoice />
            </section>
            <section>
              <h2>L&apos;apparence</h2>
              <ThemeChoice />
            </section>
          </div>
          <div className="vh-actions">
            <button className="btn primary lg" onClick={() => setStep('interview')}>
              Continuer avec l&apos;entretien
            </button>
            <button className="btn lg" onClick={() => setStep('manual')}>
              Version rapide, sans entretien
            </button>
          </div>
        </>
      )}

      {step === 'interview' && (
        <>
          <div>
            <div className="eyebrow">Entretien</div>
            <h1>Parlons de toi.</h1>
            <p className="lede">Réponds comme tu parlerais à quelqu&apos;un. Pas besoin d&apos;être précis, l&apos;IA reformule.</p>
          </div>
          <div className="chat" ref={chatRef} aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`bubble ${m.role === 'user' ? 'me' : 'ai'}`}>
                {m.content}
              </div>
            ))}
            {thinking && (
              <div className="bubble ai">
                <i className="spin" />
              </div>
            )}
          </div>
          {error && <div className="alert crit">{error}</div>}
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="sr" htmlFor="onb-answer">
              Ta réponse
            </label>
            <textarea
              id="onb-answer"
              className="inp"
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ta réponse… (Entrée pour envoyer)"
              autoFocus
            />
            <button className="btn primary lg" type="submit" disabled={!draft.trim() || thinking}>
              Envoyer
            </button>
          </form>
          <div className="vh-actions">
            <button className="btn lg" onClick={recap} disabled={userTurns < 3 || thinking}>
              Voir le récap
            </button>
            <span className="hint">{userTurns < 3 ? `Encore ${3 - userTurns} réponse${3 - userTurns > 1 ? 's' : ''} avant de pouvoir voir le récap.` : "Tu peux continuer ou voir le récap quand tu veux."}</span>
          </div>
        </>
      )}

      {step === 'recap' && summary && (
        <>
          <div>
            <div className="eyebrow">Récap</div>
            <h1>Voilà ce que j&apos;ai compris.</h1>
            <p className="lede">Décoche ce qui n&apos;est pas juste. Tu pourras tout modifier ensuite.</p>
          </div>
          <div className="sec">
            <h2>Domaines de vie</h2>
            <div className="review-list">
              {summary.domains.map((d, i) => (
                <label key={i} className={`check-row${d.on ? '' : ' off'}`}>
                  <input type="checkbox" checked={d.on} onChange={() => setSummary({ ...summary, domains: summary.domains.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })} />
                  <span className="t">{d.name}</span>
                </label>
              ))}
            </div>
          </div>
          {HORIZONS.map(([hz, label]) => {
            const gs = summary.goals.map((g, i) => [g, i] as const).filter(([g]) => g.horizon === hz);
            if (!gs.length) return null;
            return (
              <div className="sec" key={hz}>
                <h2>{label}</h2>
                <div className="review-list">
                  {gs.map(([g, i]) => (
                    <label key={i} className={`check-row${g.on ? '' : ' off'}`}>
                      <input type="checkbox" checked={g.on} onChange={() => setSummary({ ...summary, goals: summary.goals.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })} />
                      <span className="t">{g.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="sec">
            <h2>Projets en cours</h2>
            <div className="review-list">
              {summary.projects.map((p, i) => (
                <label key={i} className={`check-row${p.on ? '' : ' off'}`}>
                  <input type="checkbox" checked={p.on} onChange={() => setSummary({ ...summary, projects: summary.projects.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })} />
                  <span>
                    <span className="t">{p.name}</span>
                    <span className="m">
                      {p.domain && <span className="chip">{p.domain}</span>}
                      {p.outcome && <span>{p.outcome}</span>}
                      {p.nextAction && <span>Prochaine action : {p.nextAction}</span>}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="sec">
            <h2>Ce que je retiens de toi</h2>
            <p className="hint" style={{ margin: '0 0 8px' }}>Ton travail, tes horaires, tes habitudes : je m&apos;en sers pour ranger et planifier tes journées. Corrige si besoin.</p>
            <textarea className="inp" rows={4} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Ex. Travaille chez VINCI Energies du lundi au vendredi, 9h-18h. Sport le mardi soir." />
          </div>
          <div className="vh-actions">
            <button className="btn primary lg" onClick={createFromSummary}>
              Créer mon espace
            </button>
            <button className="btn lg" onClick={() => setStep('interview')}>
              Revenir à l&apos;entretien
            </button>
          </div>
        </>
      )}

      {step === 'manual' && (
        <>
          <div>
            <div className="eyebrow">Version rapide</div>
            <h1>Tes domaines de vie.</h1>
            <p className="lede">Choisis les grandes zones de ta vie. Tes projets seront rangés dedans. Tu pourras en ajouter et en renommer plus tard.</p>
          </div>
          {error && <div className="alert">{error}</div>}
          <div className="pick">
            {DOMAIN_SUGGESTIONS.map((d) => (
              <button key={d} className={manualDomains.includes(d) ? 'on' : ''} onClick={() => setManualDomains((m) => (m.includes(d) ? m.filter((x) => x !== d) : [...m, d]))}>
                {d}
              </button>
            ))}
          </div>
          <div className="vh-actions">
            <button className="btn primary lg" onClick={createManual} disabled={!manualDomains.length}>
              Continuer
            </button>
          </div>
        </>
      )}

      {step === 'tools' && (
        <>
          <div>
            <div className="eyebrow">Tes outils</div>
            <h1>Récupère tes projets en cours.</h1>
            <p className="lede">Connecte un outil, l&apos;IA te propose des projets et des actions, tu coches ce que tu gardes. Tu peux aussi le faire plus tard depuis « Importer ».</p>
          </div>
          <ImportPanel
            onDone={() => {
              toast({ text: 'Import terminé' });
            }}
          />
          <div className="vh-actions">
            <button className="btn primary lg" onClick={() => setStep('first')}>
              Continuer
            </button>
            <button className="btn lg" onClick={() => setStep('first')}>
              Plus tard
            </button>
          </div>
        </>
      )}

      {step === 'first' && (
        <>
          <div>
            <div className="eyebrow">Premier essai</div>
            <h1>
              Note ce que tu as <em>en tête</em>.
            </h1>
            <p className="lede">Écris comme ça vient, plusieurs choses d&apos;un coup si tu veux. L&apos;IA en fait des actions claires, avec la date, le projet et les liens pour agir.</p>
          </div>
          <form
            className="halo onb-first"
            onSubmit={(e) => {
              e.preventDefault();
              tryFirst(first);
            }}
          >
            <div className="capture">
              <label htmlFor="onb-first" className="sr">
                Ta première note
              </label>
              <input id="onb-first" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Note une idée, une tâche, un rendez-vous…" autoFocus autoComplete="off" />
              <button className="btn primary" type="submit" disabled={!first.trim()}>
                Capturer
              </button>
            </div>
          </form>
          <div className="onb-examples">
            <span className="hint">Ou essaie avec :</span>
            {FIRST_EXAMPLES.map((x) => (
              <button key={x} className="chip link" onClick={() => tryFirst(x)}>
                {x}
              </button>
            ))}
          </div>
          <div className="vh-actions">
            <button className="btn lg" onClick={finish}>
              Passer, aller à ma journée
            </button>
          </div>
        </>
      )}
    </div>
  );
}
