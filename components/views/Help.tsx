'use client';
import { useUI } from '../ui-context';
import { Head } from './Calendar';

const STEPS: { t: string; d: string }[] = [
  { t: '1. Tu notes', d: "Tape tout ce qui te passe par la tête dans la barre « Capturer » (touche C, ou le bouton + sur téléphone). Plusieurs choses d'un coup, c'est possible : « réunion RESAH jeudi 14h, relancer François pour le devis, acheter des gants de MMA »." },
  { t: '2. L’IA range', d: "Elle crée une carte par élément, la met dans le bon projet, lui donne une date, une heure, une durée si tu les as dites. Les cartes rangées par l'IA portent un badge IA : clique dessus pour vérifier, puis « C'est bon »." },
  { t: '3. Tu planifies', d: "Dans « Ma journée », glisse une carte sur l'agenda. Tire le bas d'un bloc pour l'allonger, attrape-le pour le déplacer. Clique sur un créneau vide pour ajouter quelque chose à cette heure-là." },
  { t: '4. Tu fais', d: 'Coche une tâche quand elle est faite. Si elle se répète (tous les mardis, chaque mois…), la suivante est créée toute seule.' },
  { t: '5. Tu fais le point', d: "La revue te guide : vider l'inbox, vérifier chaque projet, préparer la suite. Choisis son rythme dans les réglages : chaque jour, tous les 3 jours, chaque semaine, chaque mois." },
];

const WORDS: [string, string][] = [
  ['Tâche', 'Une action que tu peux cocher : « Appeler le comptable ».'],
  ['Événement', "Quelque chose qui a lieu à un moment donné : réunion, anniversaire, cours. Ça ne se coche pas, ça s'affiche dans l'agenda."],
  ['Projet', "Tout ce qui demande plus d'une action. Chaque projet a sa couleur dans le calendrier."],
  ['Domaine', 'Une grande partie de ta vie : Travail, Sport, Musique… Les projets sont rangés dedans.'],
  ['Inbox', "Ce que tu as noté mais pas encore rangé. L'objectif : la vider régulièrement."],
  ['Prochaine action', 'La toute prochaine chose concrète à faire pour avancer un projet.'],
  ['Épinglé', 'Un article, une vidéo ou un outil gardé pour un projet.'],
  ['Contexte', "Où tu peux faire l'action (@ordi, @téléphone…). Facultatif : désactive-le dans les réglages si ça ne te sert pas."],
];

export function HelpView() {
  const { go, set } = useUI();
  return (
    <>
      <Head eyebrow="Aide" title="Comment ça marche" lede="Le principe en une phrase : tu notes tout, l'appli range, tu choisis quoi faire et quand." />
      <div className="stack">
        <div className="help-steps">
          {STEPS.map((s) => (
            <div className="help-step" key={s.t}>
              <b>{s.t}</b>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
        <div className="sec">
          <div className="sec-head">
            <h2>Les mots de l&apos;appli</h2>
          </div>
          <dl className="kv words">
            {WORDS.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="sec">
          <div className="sec-head">
            <h2>Raccourcis</h2>
          </div>
          <dl className="kv words">
            <div>
              <dt>
                <span className="kbd">C</span>
              </dt>
              <dd>Capturer</dd>
            </div>
            <div>
              <dt>
                <span className="kbd">J</span> <span className="kbd">S</span> <span className="kbd">M</span>
              </dt>
              <dd>Journée, semaine, mois</dd>
            </div>
            <div>
              <dt>
                <span className="kbd">Échap</span>
              </dt>
              <dd>Fermer</dd>
            </div>
          </dl>
        </div>
        <div className="addrow">
          <button className="btn primary" onClick={() => set({ captureOpen: true })}>
            Capturer quelque chose
          </button>
          <button className="btn" onClick={() => go('settings')}>
            Adapter l&apos;appli
          </button>
        </div>
      </div>
    </>
  );
}
