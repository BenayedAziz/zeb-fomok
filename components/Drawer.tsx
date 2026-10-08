'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import type { Item, Project, Recurrence } from '@/lib/types';
import { useUI } from './ui-context';
import { Icon } from './icons';
import { COLORS, DURATIONS, HORIZONS, PRIORITIES, PSTATUSES, RECURRENCES, STATUSES, ST, WEEKDAYS_PICK, colorKeyOfProject, contextsOf, domainsSorted, goalsSorted, freeColor, hostOf, isEvent, linksIn, projectsSorted, recLabel } from '@/lib/gtd';
import { fmtDuration, todayIso } from '@/lib/dates';

function Head({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="dr-head">
      <span className="eyebrow" style={{ margin: 0 }}>
        {label}
      </span>
      <button className="icon-btn" onClick={onClose} aria-label="Fermer">
        <Icon name="x" />
      </button>
    </div>
  );
}

/** Champ texte qui enregistre à la sortie du champ. */
function TextField({ id, value, onSave, area, rows, placeholder, className }: { id: string; value: string; onSave: (v: string) => void; area?: boolean; rows?: number; placeholder?: string; className?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const save = () => v !== value && onSave(v);
  return area ? (
    <textarea id={id} className={className || 'inp'} rows={rows || 4} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={save} />
  ) : (
    <input id={id} className={className || 'inp'} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
  );
}

function ProjectSelect({ value, onChange, id }: { value?: string | null; onChange: (v: string | null) => void; id: string }) {
  const { data } = useStore();
  const doms = domainsSorted(data);
  const ps = projectsSorted(data).filter((p) => p.status !== 'done' || p.id === value);
  return (
    <select className="inp" id={id} value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Aucun projet</option>
      {doms.map((d) => {
        const inD = ps.filter((p) => p.domainId === d.id);
        return inD.length ? (
          <optgroup key={d.id} label={d.name}>
            {inD.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
      {ps
        .filter((p) => !p.domainId || !data.domains[p.domainId])
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
    </select>
  );
}

function ItemDrawer({ id }: { id: string }) {
  const store = useStore();
  const { ui, closeDrawer, aiSort, removeItem } = useUI();
  const it = store.data.items[id];
  const s = store.data.settings;
  if (!it) return null;
  const ev = isEvent(it);
  const save = (p: Partial<Item>) => {
    const patch: Partial<Item> = { ...p, aiSorted: false };
    if ('status' in p) {
      patch.doneAt = p.status === 'done' ? todayIso() : null;
      if (p.status === 'waiting' && !it.waitingSince) patch.waitingSince = todayIso();
    }
    if ('date' in p && !p.date) {
      patch.time = null;
      patch.recurrence = null;
    }
    if ('time' in p && p.time && !it.date) patch.date = todayIso();
    if ('time' in p && p.time && !it.duration && !('duration' in p)) patch.duration = ev ? 60 : 30;
    if ('recurrence' in p && p.recurrence && !it.date) patch.date = todayIso();
    if ('recurrence' in p && p.recurrence !== 'weekly') patch.recurrenceDays = null;
    if ('recurrence' in p && !p.recurrence) patch.recurrenceInterval = null;
    if ('title' in p && !String(p.title || '').trim()) return;
    store.updateItem(id, patch);
  };
  const setKind = (k: 'task' | 'event') => {
    if (k === (ev ? 'event' : 'task')) return;
    save(k === 'event' ? { kind: 'event', status: it.status === 'done' ? 'todo' : it.status === 'inbox' ? 'todo' : it.status, context: null, priority: null } : { kind: 'task' });
  };
  const wd = it.date ? new Date(it.date + 'T12:00').getDay() : null;
  const days = it.recurrenceDays?.length ? it.recurrenceDays : wd !== null ? [wd] : [];
  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    if (next.length) save({ recurrenceDays: next });
  };
  const unit = it.recurrence === 'weekly' ? 'semaine(s)' : it.recurrence === 'monthly' ? 'mois' : it.recurrence === 'yearly' ? 'an(s)' : 'jour(s)';
  const durs = it.duration && !DURATIONS.some(([m]) => m === it.duration) ? [...DURATIONS, [it.duration, fmtDuration(it.duration)] as [number, string]].sort((a, b) => a[0] - b[0]) : DURATIONS;
  const links = linksIn(it.notes);
  return (
    <>
      <Head label={ev ? 'Événement' : ST[it.status] || 'Élément'} onClose={closeDrawer} />
      <div className="dr-body">
        <div className="seg kind" role="tablist" aria-label="Type">
          <button className={!ev ? 'on' : ''} onClick={() => setKind('task')}>
            <Icon name="done" /> Tâche
          </button>
          <button className={ev ? 'on' : ''} onClick={() => setKind('event')}>
            <Icon name="cal" /> Événement
          </button>
        </div>
        <label className="sr" htmlFor="d-title">
          Titre
        </label>
        <TextField id="d-title" area rows={2} className="dr-title" value={it.title} onSave={(v) => save({ title: v })} />
        {it.aiSorted && (
          <div className="note-box">
            <span>
              <b>Rangé par l&apos;IA.</b> {it.aiReason}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn sm primary" onClick={() => store.updateItem(id, { aiSorted: false })}>
                C&apos;est bon
              </button>
              {it.raw && it.raw !== it.title && <span className="hint">Tu avais noté : « {it.raw} »</span>}
            </div>
          </div>
        )}
        {it.status === 'inbox' && !ui.aiOff && (
          <div className="note-box">
            <span>Pas encore rangé.</span>
            <div>
              <button className="btn sm primary" disabled={!!ui.pending[id]} onClick={() => aiSort(id)}>
                {ui.pending[id] ? "L'IA range…" : "Ranger avec l'IA"}
              </button>
            </div>
          </div>
        )}
        <div className="row2">
          <label className="fld">
            <span>Date</span>
            <input className="inp" type="date" id="d-date" value={it.date || ''} onChange={(e) => save({ date: e.target.value || null })} />
          </label>
          <label className="fld">
            <span>{ev ? 'Heure (vide = toute la journée)' : 'Heure'}</span>
            <input className="inp" type="time" id="d-time" value={it.time || ''} onChange={(e) => save({ time: e.target.value || null })} />
          </label>
        </div>
        <div className="fld">
          <span>Durée</span>
          <div className="pick">
            <button className={!it.duration ? 'on' : ''} onClick={() => save({ duration: null })}>
              Aucune
            </button>
            {durs.map(([m, l]) => (
              <button key={m} className={it.duration === m ? 'on' : ''} onClick={() => save({ duration: m })}>
                {l}
              </button>
            ))}
          </div>
          {it.time && <span className="hint">Astuce : dans l&apos;agenda, tire le bas du bloc pour l&apos;allonger.</span>}
        </div>
        <label className="fld">
          <span>Se répète</span>
          <select className="inp" id="d-rec" value={it.recurrence || ''} onChange={(e) => save({ recurrence: (e.target.value || null) as Recurrence | null })}>
            <option value="">Ne se répète pas</option>
            {RECURRENCES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {it.recurrence && (
          <div className="rec-box">
            {it.recurrence === 'weekly' && (
              <div className="days" role="group" aria-label="Jours">
                {WEEKDAYS_PICK.map(([d, l]) => (
                  <button key={d} className={days.includes(d) ? 'on' : ''} onClick={() => toggleDay(d)} aria-pressed={days.includes(d)}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            {it.recurrence !== 'weekdays' && (
              <label className="every">
                Tous les
                <input
                  className="inp"
                  type="number"
                  min={1}
                  max={99}
                  value={it.recurrenceInterval || 1}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(99, Number(e.target.value) || 1));
                    save({ recurrenceInterval: n > 1 ? n : null });
                  }}
                />
                {unit}
              </label>
            )}
            <span className="hint">{recLabel(it)}</span>
          </div>
        )}
        <label className="fld">
          <span>Projet</span>
          <ProjectSelect id="d-project" value={it.projectId} onChange={(v) => save({ projectId: v, domainId: v ? store.data.projects[v]?.domainId || it.domainId : it.domainId })} />
        </label>
        {!ev && (
          <div className="fld">
            <span>Statut</span>
            <div className="seg wrap">
              {STATUSES.filter(([k]) => s.showWaitingSomeday || (k !== 'waiting' && k !== 'someday') || it.status === k).map(([k, l]) => (
                <button key={k} className={it.status === k ? 'on' : ''} onClick={() => save({ status: k })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
        {!ev && s.showContexts && (
          <div className="fld">
            <span>Contexte</span>
            <div className="pick">
              {contextsOf(s).map(([k, l]) => (
                <button key={k} className={it.context === k ? 'on' : ''} onClick={() => save({ context: it.context === k ? null : k })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
        {!ev && s.showPriorities && (
          <div className="fld">
            <span>Priorité</span>
            <div className="seg">
              {[['', 'Aucune'] as [string, string], ...PRIORITIES].map(([k, l]) => (
                <button key={k} className={(it.priority || '') === k ? 'on' : ''} onClick={() => save({ priority: (k || null) as Item['priority'] })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
        {it.status === 'waiting' && (
          <label className="fld">
            <span>En attente de</span>
            <TextField id="d-who" value={it.waitingFor || ''} placeholder="Qui ? (une personne, Hermes…)" onSave={(v) => save({ waitingFor: v || null })} />
          </label>
        )}
        <label className="fld">
          <span>Notes</span>
          <TextField id="d-notes" area rows={5} value={it.notes || ''} placeholder="Détails, liens, contexte…" onSave={(v) => save({ notes: v || null })} />
        </label>
        {links.length > 0 && (
          <div className="links">
            {links.map((l) => (
              <a key={l} href={l} target="_blank" rel="noopener noreferrer">
                {l.replace(/^https?:\/\/(www\.)?/, '').slice(0, 70)}
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="dr-foot">
        <button className="btn ghost danger" onClick={() => removeItem(id)}>
          Supprimer
        </button>
        <button className="btn" onClick={closeDrawer}>
          Fermer
        </button>
      </div>
    </>
  );
}

function ProjectDrawer({ id, draft }: { id: string | null; draft?: Record<string, string> }) {
  const store = useStore();
  const { closeDrawer, go, toast } = useUI();
  const creating = !id;
  const p = id ? store.data.projects[id] : null;
  const [form, setForm] = useState<Record<string, string>>(() => ({ name: '', outcome: '', description: '', domainId: '', dueDate: '', goalId: '', ...(draft || {}) }));
  const [confirm, setConfirm] = useState(false);
  if (!creating && !p) return null;
  const val = (k: keyof Project) => (creating ? form[k as string] || '' : ((p![k] as string) || ''));
  const change = (k: keyof Project, v: string) => {
    if (creating) setForm((f) => ({ ...f, [k]: v }));
    else store.updateProject(id!, { [k]: v || null } as Partial<Project>);
  };
  const create = () => {
    if (!form.name.trim()) return toast({ text: 'Donne un nom au projet.' });
    const np = store.addProject({
      name: form.name.trim(),
      outcome: form.outcome || null,
      description: form.description || null,
      domainId: form.domainId || null,
      dueDate: form.dueDate || null,
      goalId: form.goalId || null,
      color: form.color || freeColor(store.data),
    });
    go('project', { projectId: np.id });
  };
  const text = (k: keyof Project, label: string, ph: string, area?: number) => (
    <label className="fld">
      <span>{label}</span>
      {creating ? (
        area ? (
          <textarea className="inp" rows={area} value={val(k)} placeholder={ph} onChange={(e) => change(k, e.target.value)} />
        ) : (
          <input className="inp" value={val(k)} placeholder={ph} onChange={(e) => change(k, e.target.value)} autoFocus={k === 'name'} />
        )
      ) : (
        <TextField id={`dp-${k}`} area={!!area} rows={area} value={val(k)} placeholder={ph} onSave={(v) => (k === 'name' && !v.trim() ? null : change(k, v))} />
      )}
    </label>
  );
  return (
    <>
      <Head label={creating ? 'Nouveau projet' : 'Projet'} onClose={closeDrawer} />
      <div className="dr-body">
        {text('name', 'Nom', 'Ex. Lancer le site Oria Med')}
        {text('outcome', 'Résultat attendu', 'À quoi ressemble « terminé » ?', 2)}
        {text('description', 'Description', 'Infos générales, contexte…', 3)}
        <div className="row2">
          <label className="fld">
            <span>Domaine</span>
            <select className="inp" value={val('domainId')} onChange={(e) => change('domainId', e.target.value)}>
              <option value="">Aucun</option>
              {domainsSorted(store.data).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="fld">
            <span>Échéance</span>
            <input className="inp" type="date" value={val('dueDate')} onChange={(e) => change('dueDate', e.target.value)} />
          </label>
        </div>
        <div className="fld">
          <span>Couleur dans le calendrier</span>
          <div className="swatches">
            {COLORS.map((c) => {
              const cur = creating ? form.color || '' : colorKeyOfProject(store.data, p);
              return (
                <button
                  key={c}
                  className={cur === c ? 'on' : ''}
                  style={{ background: `var(--${c})` }}
                  onClick={() => (creating ? setForm((f) => ({ ...f, color: c })) : store.updateProject(id!, { color: c }))}
                  aria-label={`Couleur ${c}`}
                />
              );
            })}
          </div>
        </div>
        <label className="fld">
          <span>Objectif relié</span>
          <select className="inp" value={val('goalId')} onChange={(e) => change('goalId', e.target.value)}>
            <option value="">Aucun</option>
            {HORIZONS.map(([hz, l]) => {
              const gs = goalsSorted(store.data).filter((g) => g.horizon === hz);
              return gs.length ? (
                <optgroup key={hz} label={l}>
                  {gs.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
        </label>
        {!creating && (
          <div className="fld">
            <span>Statut</span>
            <div className="seg">
              {PSTATUSES.map(([k, l]) => (
                <button key={k} className={p!.status === k ? 'on' : ''} onClick={() => store.updateProject(id!, { status: k })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="dr-foot">
        {creating ? (
          <>
            <button className="btn" onClick={closeDrawer}>
              Annuler
            </button>
            <button className="btn primary" onClick={create}>
              Créer le projet
            </button>
          </>
        ) : (
          <>
            <button
              className="btn ghost danger"
              onClick={() => {
                if (!confirm) return setConfirm(true);
                store.removeProject(id!);
                go('projects');
                toast({ text: 'Projet supprimé. Ses cartes restent dans tes listes.' });
              }}
            >
              {confirm ? 'Confirmer la suppression' : 'Supprimer'}
            </button>
            <button className="btn" onClick={closeDrawer}>
              Fermer
            </button>
          </>
        )}
      </div>
    </>
  );
}

function GoalDrawer({ id }: { id: string }) {
  const store = useStore();
  const { closeDrawer, go, toast } = useUI();
  const g = store.data.goals[id];
  if (!g) return null;
  const ps = projectsSorted(store.data).filter((p) => p.goalId === id);
  return (
    <>
      <Head label="Objectif" onClose={closeDrawer} />
      <div className="dr-body">
        <TextField id="dg-title" area rows={2} className="dr-title" value={g.title} onSave={(v) => v.trim() && store.updateGoal(id, { title: v })} />
        <div className="fld">
          <span>Horizon</span>
          <div className="seg">
            {HORIZONS.map(([k, l]) => (
              <button key={k} className={g.horizon === k ? 'on' : ''} onClick={() => store.updateGoal(id, { horizon: k })}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <label className="fld">
          <span>Pourquoi c&apos;est important, où tu en es</span>
          <TextField id="dg-notes" area rows={6} value={g.notes || ''} placeholder="Ce qui marche, ce qui bloque…" onSave={(v) => store.updateGoal(id, { notes: v || null })} />
        </label>
        <div className="fld">
          <span>Projets reliés</span>
          {ps.length ? (
            <div className="pick">
              {ps.map((p) => (
                <button key={p.id} onClick={() => go('project', { projectId: p.id })}>
                  {p.name}
                </button>
              ))}
            </div>
          ) : (
            <span className="hint">Aucun. Relie un projet depuis sa fiche.</span>
          )}
        </div>
      </div>
      <div className="dr-foot">
        <button
          className="btn ghost danger"
          onClick={() => {
            store.removeGoal(id);
            closeDrawer();
            toast({ text: 'Objectif supprimé' });
          }}
        >
          Supprimer
        </button>
        <button className="btn" onClick={closeDrawer}>
          Fermer
        </button>
      </div>
    </>
  );
}

function PinDrawer({ id }: { id: string }) {
  const store = useStore();
  const { closeDrawer, toast } = useUI();
  const p = store.data.pins[id];
  if (!p) return null;
  return (
    <>
      <Head label="Ressource épinglée" onClose={closeDrawer} />
      <div className="dr-body">
        <TextField id="dpin-title" area rows={2} className="dr-title" value={p.title} onSave={(v) => v.trim() && store.updatePin(id, { title: v.trim(), aiSorted: false })} />
        <a className="pin-link" href={p.url} target="_blank" rel="noopener noreferrer">
          <Icon name="link" /> {hostOf(p.url)}
        </a>
        <label className="fld">
          <span>Adresse</span>
          <TextField id="dpin-url" value={p.url} onSave={(v) => v.trim() && store.updatePin(id, { url: v.trim() })} />
        </label>
        <label className="fld">
          <span>Projet</span>
          <ProjectSelect id="dpin-project" value={p.projectId} onChange={(v) => store.updatePin(id, { projectId: v, aiSorted: false })} />
        </label>
        <label className="fld">
          <span>Pourquoi je la garde</span>
          <TextField id="dpin-note" area rows={4} value={p.note || ''} placeholder="Ce que tu veux en retenir, quand t'en servir…" onSave={(v) => store.updatePin(id, { note: v || null })} />
        </label>
      </div>
      <div className="dr-foot">
        <button
          className="btn ghost danger"
          onClick={() => {
            const row = store.removePin(id);
            closeDrawer();
            toast({ text: 'Ressource retirée', actions: row ? [{ label: 'Annuler', run: () => store.restore('pins', row) }] : undefined });
          }}
        >
          Retirer
        </button>
        <button className="btn" onClick={closeDrawer}>
          Fermer
        </button>
      </div>
    </>
  );
}

function DomainDrawer({ id }: { id: string | null }) {
  const store = useStore();
  const { closeDrawer, go, toast } = useUI();
  const d = id ? store.data.domains[id] : null;
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[Object.keys(store.data.domains).length % COLORS.length]);
  const [confirm, setConfirm] = useState(false);
  if (id && !d) return null;
  return (
    <>
      <Head label={d ? 'Domaine' : 'Nouveau domaine'} onClose={closeDrawer} />
      <div className="dr-body">
        <label className="fld">
          <span>Nom</span>
          {d ? (
            <TextField id="dd-name" value={d.name} onSave={(v) => v.trim() && store.updateDomain(d.id, { name: v.trim() })} />
          ) : (
            <input className="inp" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. VINCI, Freelance, Sport…" />
          )}
        </label>
        <div className="fld">
          <span>Couleur</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                className={(d ? d.color : color) === c ? 'on' : ''}
                style={{ background: `var(--${c})` }}
                onClick={() => (d ? store.updateDomain(d.id, { color: c }) : setColor(c))}
                aria-label={`Couleur ${c}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="dr-foot">
        {d ? (
          <>
            <button
              className="btn ghost danger"
              onClick={() => {
                if (!confirm) return setConfirm(true);
                store.removeDomain(d.id);
                go('projects');
                toast({ text: 'Domaine supprimé. Ses projets passent « sans domaine ».' });
              }}
            >
              {confirm ? 'Confirmer la suppression' : 'Supprimer'}
            </button>
            <button className="btn" onClick={closeDrawer}>
              Fermer
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={closeDrawer}>
              Annuler
            </button>
            <button
              className="btn primary"
              onClick={() => {
                if (!name.trim()) return toast({ text: 'Donne un nom au domaine.' });
                store.addDomain({ name: name.trim(), color });
                closeDrawer();
              }}
            >
              Créer
            </button>
          </>
        )}
      </div>
    </>
  );
}

export function Drawer() {
  const { ui, closeDrawer } = useUI();
  const dr = ui.drawer;
  if (!dr) return null;
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="scrim" onClick={closeDrawer} />
      <section className="drawer">
        {dr.type === 'item' && <ItemDrawer id={dr.id} key={dr.id} />}
        {dr.type === 'project' && <ProjectDrawer id={dr.id} draft={dr.draft} key={dr.id || 'new'} />}
        {dr.type === 'goal' && <GoalDrawer id={dr.id} key={dr.id} />}
        {dr.type === 'pin' && <PinDrawer id={dr.id} key={dr.id} />}
        {dr.type === 'domain' && <DomainDrawer id={dr.id} key={dr.id || 'new'} />}
      </section>
    </div>
  );
}
