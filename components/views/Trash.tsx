'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { useUI } from '../ui-context';
import { Head } from './Calendar';
import { relDate, todayIso } from '@/lib/dates';
import { list } from '@/lib/gtd';
import type { Item, Pin } from '@/lib/types';

/** Ce qui a été supprimé ces 30 derniers jours : on peut le remettre en place ou l'effacer pour de bon. */
export function TrashView() {
  const store = useStore();
  const { toast } = useUI();
  const [confirm, setConfirm] = useState(false);
  const entries = list(store.data.trash).sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));

  return (
    <>
      <Head
        eyebrow="Récupérer"
        title="Corbeille"
        lede="Ce que tu as supprimé reste ici 30 jours. Remets-le en place d'un clic, ou efface-le pour de bon."
        actions={
          entries.length > 0 ? (
            <button
              className={`btn ghost danger${confirm ? ' on' : ''}`}
              onClick={() => {
                if (!confirm) return setConfirm(true);
                store.purgeTrash();
                setConfirm(false);
                toast({ text: 'Corbeille vidée' });
              }}
              onBlur={() => setConfirm(false)}
            >
              {confirm ? 'Confirmer : tout effacer' : 'Vider la corbeille'}
            </button>
          ) : undefined
        }
      />
      {entries.length === 0 ? (
        <div className="empty">
          <b>Corbeille vide.</b> Quand tu supprimes une tâche, un événement ou une ressource, il atterrit ici pendant 30 jours.
        </div>
      ) : (
        <div className="trash-list">
          {entries.map((t) => {
            const row = t.rowData as Item & Pin;
            const day = t.deletedAt.slice(0, 10);
            const left = Math.max(0, 30 - Math.floor((Date.now() - Date.parse(t.deletedAt)) / 864e5));
            return (
              <div key={t.id} className="trash-row">
                <div className="trash-main">
                  <b>{row.title || row.url || 'Sans titre'}</b>
                  <span className="hint">
                    {t.kind === 'pins' ? 'Ressource' : row.kind === 'event' ? 'Événement' : 'Tâche'} · supprimé {day === todayIso() ? "aujourd'hui" : relDate(day).toLowerCase()} · encore {left} j
                  </span>
                </div>
                <button
                  className="btn sm"
                  onClick={() => {
                    store.restoreTrash(t.id);
                    toast({ text: 'Remis à sa place' });
                  }}
                >
                  Restaurer
                </button>
                <button className="btn sm ghost danger" onClick={() => store.purgeTrash(t.id)} aria-label={`Effacer définitivement ${row.title || ''}`}>
                  Effacer
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
