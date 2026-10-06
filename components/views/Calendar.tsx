'use client';
import { useStore } from '@/lib/store';
import { useUI, type CalMode } from '../ui-context';
import { Card } from '../Card';
import { Icon } from '../icons';
import { CONTEXTS, HOURS, backlog, colorOfItem, colorOfProject, counts, goalsSorted, lastReviewDays, list, onDate, overdue } from '@/lib/gtd';
import { DAYS, DSHORT, MONTHS, MSHORT, addDays, isoOf, isoWeek, mondayOf, pad, parseIso, todayIso } from '@/lib/dates';

export function Head({ eyebrow, title, lede, actions }: { eyebrow: string; title: React.ReactNode; lede?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="vh">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {actions && <div className="vh-actions">{actions}</div>}
    </header>
  );
}

function CalNav() {
  const { ui, set } = useUI();
  const shift = (dir: number) => {
    if (ui.cal === 'day') set({ date: addDays(ui.date, dir) });
    else if (ui.cal === 'week') set({ date: addDays(ui.date, 7 * dir) });
    else {
      const d = parseIso(ui.date);
      set({ date: isoOf(new Date(d.getFullYear(), d.getMonth() + dir, 1)) });
    }
  };
  return (
    <>
      <div className="cal-nav">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Précédent">
          <Icon name="left" />
        </button>
        <button className="btn sm" onClick={() => set({ date: todayIso() })}>
          Aujourd&apos;hui
        </button>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Suivant">
          <Icon name="right" />
        </button>
      </div>
      <div className="seg" role="group" aria-label="Affichage">
        {(
          [
            ['day', 'Jour'],
            ['week', 'Semaine'],
            ['month', 'Mois'],
          ] as [CalMode, string][]
        ).map(([k, l]) => (
          <button key={k} className={ui.cal === k ? 'on' : ''} onClick={() => set({ cal: k })}>
            {l}
          </button>
        ))}
      </div>
    </>
  );
}

export function Compass() {
  const { data } = useStore();
  const { openDrawer } = useUI();
  const g = goalsSorted(data).filter((x) => x.horizon === 'year');
  if (!g.length) return null;
  return (
    <div className="compass">
      <span className="lbl">Cap</span>
      {g.map((x) => (
        <button key={x.id} className="g" onClick={() => openDrawer({ type: 'goal', id: x.id })}>
          {x.title}
        </button>
      ))}
    </div>
  );
}

export function PlanPanel({ projectId, flat }: { projectId?: string | null; flat?: boolean }) {
  const { data } = useStore();
  const { ui, set, schedule } = useUI();
  let bl = backlog(data, projectId);
  if (ui.ctx !== 'all') bl = bl.filter((i) => i.context === ui.ctx);
  const od = projectId ? [] : overdue(data);
  return (
    <aside className={`panel${flat ? ' flat' : ''}`} data-drop="backlog" aria-label="À planifier">
      {od.length > 0 && (
        <div className="sec">
          <div className="sec-head">
            <h2 style={{ color: 'var(--crit)' }}>
              En retard <span className="n">{od.length}</span>
            </h2>
            <button className="btn sm" onClick={() => od.forEach((i) => schedule(i.id, todayIso()))}>
              Tout mettre aujourd&apos;hui
            </button>
          </div>
          <div className="cards">
            {od.map((i) => (
              <Card key={i.id} it={i} />
            ))}
          </div>
        </div>
      )}
      <div className="sec">
        <div className="sec-head">
          <h2>
            À planifier <span className="n">{bl.length}</span>
          </h2>
        </div>
        <div className="pick">
          {[['all', 'Tout'] as [string, string]].concat(CONTEXTS).map(([k, l]) => (
            <button key={k} className={ui.ctx === k ? 'on' : ''} onClick={() => set({ ctx: k })}>
              {l}
            </button>
          ))}
        </div>
        {bl.length ? (
          <div className="cards">
            {bl.map((i) => (
              <Card key={i.id} it={i} />
            ))}
          </div>
        ) : (
          <div className="empty">
            Rien à planifier{ui.ctx !== 'all' ? ' dans ce contexte' : ''}. Les prochaines actions sans date arrivent ici : glisse-les dans le calendrier, ou utilise le bouton calendrier d&apos;une carte.
          </div>
        )}
      </div>
    </aside>
  );
}

function Alerts() {
  const { data } = useStore();
  const { go } = useUI();
  const c = counts(data);
  const lr = lastReviewDays(data);
  return (
    <>
      {c.inbox > 0 && (
        <div className="alert info">
          <span>
            <b>{c.inbox}</b> élément{c.inbox > 1 ? 's' : ''} dans l&apos;inbox à ranger.
          </span>
          <button className="btn sm" onClick={() => go('inbox')}>
            Ouvrir l&apos;inbox
          </button>
        </div>
      )}
      {(lr === null || lr >= 7) && list(data.items).length > 0 && (
        <div className="alert">
          <span>{lr === null ? 'Pas encore de revue hebdo.' : `Dernière revue hebdo il y a ${lr} jours.`} 20 minutes pour tout remettre à plat.</span>
          <button className="btn sm" onClick={() => go('review')}>
            Lancer la revue
          </button>
        </div>
      )}
    </>
  );
}

function DayView() {
  const { data } = useStore();
  const { ui } = useUI();
  const d = ui.date;
  const isToday = d === todayIso();
  const items = onDate(data, d);
  const timed = items.filter((i) => i.time);
  const untimed = items.filter((i) => !i.time);
  const dd = parseIso(d);
  const nowH = new Date().getHours();
  return (
    <>
      <Head
        eyebrow={`${isToday ? 'Ma journée' : 'Journée'} · semaine ${isoWeek(d)}`}
        title={
          isToday ? (
            <>
              <em>{DAYS[dd.getDay()]}</em> {dd.getDate()} {MONTHS[dd.getMonth()]}
            </>
          ) : (
            `${DAYS[dd.getDay()]} ${dd.getDate()} ${MONTHS[dd.getMonth()]}`
          )
        }
        actions={<CalNav />}
      />
      <Compass />
      <div className="day-grid">
        <div className="stack">
          {isToday && (
            <div className="sec">
              <Alerts />
            </div>
          )}
          <div className="sec">
            <div className="sec-head">
              <h2>
                {isToday ? "À faire aujourd'hui" : 'À faire ce jour-là'} <span className="n">{untimed.length}</span>
              </h2>
            </div>
            <div className="cards" data-drop="date" data-date={d} style={{ minHeight: 44 }}>
              {untimed.length ? (
                untimed.map((i) => <Card key={i.id} it={i} o={{ noDate: true }} />)
              ) : (
                <div className="drop-hint">Glisse ici une action pour la faire {isToday ? "aujourd'hui" : 'ce jour-là'}, sans horaire précis.</div>
              )}
            </div>
          </div>
          <div className="sec">
            <div className="sec-head">
              <h2>Agenda</h2>
              <span className="hint">Glisse une carte sur une heure pour la caler</span>
            </div>
            <div className="timeline">
              {HOURS.map((hr) => {
                const inH = timed.filter((i) => {
                  const x = parseInt(i.time || '0', 10);
                  return hr === HOURS[0] ? x <= hr : hr === HOURS[HOURS.length - 1] ? x >= hr : x === hr;
                });
                const cls = isToday && hr === nowH ? ' now' : isToday && hr < nowH ? ' past' : '';
                return (
                  <div key={hr} className={`hour${cls}`}>
                    <div className="h">{pad(hr)}:00</div>
                    <div className="slot" data-drop="date" data-date={d} data-time={`${pad(hr)}:00`}>
                      {inH.map((i) => (
                        <Card key={i.id} it={i} o={{ noDate: true, showTime: true }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <PlanPanel />
      </div>
    </>
  );
}

function WeekView() {
  const { data } = useStore();
  const { ui, set } = useUI();
  const m = mondayOf(ui.date);
  const end = addDays(m, 6);
  const md = parseIso(m);
  const ed = parseIso(end);
  const label = md.getMonth() === ed.getMonth() ? `${md.getDate()} – ${ed.getDate()} ${MONTHS[ed.getMonth()]}` : `${md.getDate()} ${MSHORT[md.getMonth()]} – ${ed.getDate()} ${MSHORT[ed.getMonth()]}`;
  const t = todayIso();
  return (
    <>
      <Head eyebrow={`Semaine ${isoWeek(m)}`} title={label} actions={<CalNav />} />
      <Compass />
      <div className="stack">
        <div className="week">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(m, i);
            const dd = parseIso(d);
            const its = onDate(data, d);
            return (
              <div key={d} className={`wcol${d === t ? ' today' : ''}`}>
                <button className="wh" onClick={() => set({ date: d, cal: 'day' })}>
                  <b>{DSHORT[dd.getDay()]}</b>
                  <span>{dd.getDate()}</span>
                </button>
                <div className="wb" data-drop="date" data-date={d} data-keeptime="1">
                  {its.map((x) => (
                    <Card key={x.id} it={x} o={{ compact: true, noDate: true }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <PlanPanel flat />
      </div>
    </>
  );
}

export function MonthGrid({ ym, projectId, compact }: { ym: string; projectId?: string | null; compact?: boolean }) {
  const { data } = useStore();
  const { ui, set, openDrawer, go } = useUI();
  const [y, mo] = ym.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const startDow = (first.getDay() + 6) % 7;
  const dim = new Date(y, mo, 0).getDate();
  const rows = Math.ceil((startDow + dim) / 7);
  const start = isoOf(new Date(y, mo - 1, 1 - startDow));
  const t = todayIso();
  const filt = projectId ? (it: { projectId?: string | null }) => it.projectId === projectId : undefined;
  const max = compact ? 2 : 3;
  return (
    <div className="month">
      <div className="mhead">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((x) => (
          <div key={x}>{x}</div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div className="mrow" key={r}>
          {Array.from({ length: 7 }, (_, c) => {
            const day = addDays(start, r * 7 + c);
            const its = onDate(data, day, filt);
            const dues = list(data.projects).filter((p) => p.dueDate === day && p.status !== 'done' && (!projectId || p.id === projectId));
            const out = day.slice(0, 7) !== ym;
            return (
              <div
                key={day}
                className={`mcell${out ? ' out' : ''}${day === t ? ' today' : ''}`}
                data-drop="date"
                data-date={day}
                data-keeptime="1"
                onClick={() => {
                  set({ date: day, cal: 'day' });
                  if (projectId) go('day');
                }}
                role="button"
                tabIndex={-1}
                aria-label={day}
              >
                <span className="d">{parseIso(day).getDate()}</span>
                {dues.map((p) => (
                  <button
                    key={p.id}
                    className="mchip due"
                    onClick={(e) => {
                      e.stopPropagation();
                      go('project', { projectId: p.id });
                    }}
                    title={`Échéance : ${p.name}`}
                  >
                    <i className="dot" style={{ background: colorOfProject(data, p) }} />
                    <span>⚑ {p.name}</span>
                  </button>
                ))}
                {its.slice(0, max).map((it) => (
                  <button
                    key={it.id}
                    className={`mchip${it.status === 'done' ? ' done' : ''}`}
                    draggable
                    data-drag={it.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDrawer({ type: 'item', id: it.id });
                    }}
                    title={it.title}
                  >
                    <i className="dot" style={{ background: colorOfItem(data, it) }} />
                    <span>
                      {it.time ? <span className="mono">{it.time} </span> : null}
                      {it.title}
                    </span>
                  </button>
                ))}
                {its.length > max && <div className="more">+{its.length - max}</div>}
              </div>
            );
          })}
        </div>
      ))}
      {ui.cal === 'month' && null}
    </div>
  );
}

function MonthView() {
  const { ui } = useUI();
  const ym = ui.date.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  return (
    <>
      <Head eyebrow="Mois" title={`${MONTHS[m - 1]} ${y}`} actions={<CalNav />} />
      <Compass />
      <div className="day-grid">
        <div>
          <MonthGrid ym={ym} />
        </div>
        <PlanPanel />
      </div>
    </>
  );
}

export function CalendarView() {
  const { ui } = useUI();
  if (ui.cal === 'week') return <WeekView />;
  if (ui.cal === 'month') return <MonthView />;
  return <DayView />;
}
