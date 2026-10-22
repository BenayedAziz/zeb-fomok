import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { getServerSupabase, serverSupabaseConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Déjà connecté : on va droit à l'appli. Si Supabase tarde, on montre la page sans attendre. */
async function signedIn() {
  if (!serverSupabaseConfigured()) return false;
  const supabase = await getServerSupabase();
  return Promise.race([
    supabase.auth.getUser().then(({ data }) => Boolean(data.user), () => false),
    new Promise<boolean>((r) => setTimeout(() => r(false), 2500)),
  ]);
}

const STEPS: [string, string, string, string][] = [
  ['1', 'Tu notes en vrac', 'À l’écrit ou à la voix, sans réfléchir à où ça va. Une idée, un rendez-vous, cinq choses d’un coup.', '/mascots/ecriture.webp'],
  ['2', 'L’IA clarifie et range', 'Chaque note devient une action concrète, avec son projet, sa date, son @contexte, et le lien pour la faire.', '/mascots/checklist.webp'],
  ['3', 'Tu avances, l’esprit léger', 'Ta journée est prête. Tu coches, un nuage danse. Le reste attend au bon endroit.', '/mascots/sommeil.webp'],
];

const FEATURES: [string, string][] = [
  ['Des liens pour agir', '« Réserver chez Canard » arrive avec le lien de réservation. « Renouveler le titre de séjour » avec la bonne démarche en ligne.'],
  ['La règle des 2 minutes', 'Ce qui se fait en moins de 2 minutes est repéré : tu le fais tout de suite et c’est réglé.'],
  ['Projets et sous-projets', 'Chaque chose rejoint son projet. Épingle ceux du moment, replie le reste, archive ce qui dort.'],
  ['Ton agenda au glisser-déposer', 'Glisse une tâche sur un créneau, étire-la pour la durée, dessine un créneau pour ajouter.'],
  ['La dictée qui comprend', 'Parle comme à un ami : « dentiste jeudi 10h et rappeler maman » devient deux éléments bien rangés.'],
  ['Tes outils importés', 'Notion, Gmail, Outlook, Todoist, Trello, ton calendrier : l’IA reprend tes projets en cours.'],
];

export default async function Home() {
  if (await signedIn()) redirect('/app');
  const cta = serverSupabaseConfigured() ? '/login?mode=signup' : '/app';
  return (
    <div className="land">
      <header className="land-nav">
        <Link href="/" className="land-brand" aria-label="Second Cerveau">
          <Logo size={44} />
        </Link>
        <nav>
          <Link href="/login" className="btn ghost">
            Se connecter
          </Link>
          <Link href={cta} className="btn primary">
            Créer mon compte
          </Link>
        </nav>
      </header>

      <main>
        <section className="land-hero">
          <div className="lh-text">
            <span className="sticker">Au 7ᵉ ciel</span>
            <h1>
              Vide ta tête.
              <br />
              <em>L&apos;IA range.</em>
            </h1>
            <p className="lede">
              Tu notes tout en vrac, à l&apos;écrit ou à la voix. Second Cerveau en fait des actions claires, les range dans tes projets, ajoute les liens pour les faire, et te prépare ta journée.
            </p>
            <div className="lh-cta">
              <Link href={cta} className="btn primary lg">
                Créer mon compte gratuit
              </Link>
              <Link href="/login" className="btn lg">
                J&apos;ai déjà un compte
              </Link>
            </div>
            <p className="hint">Gratuit pendant la phase de test · Sans carte bancaire · Prêt en 5 minutes</p>
          </div>

          <div className="lh-demo" aria-hidden="true">
            <div className="halo">
              <div className="capture demo-cap">
                <span className="cap-ico">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill="currentColor" />
                  </svg>
                </span>
                <span className="demo-typed">réserver le restau canard samedi et relancer françois pour le devis</span>
              </div>
            </div>
            <div className="demo-arrow">
              <svg viewBox="0 0 24 24">
                <path d="M12 4v14M6 12l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Rangé par l&apos;IA
            </div>
            <div className="cards">
              <div className="card has-mascot demo-card" style={{ animationDelay: '0.2s' }}>
                <span className="ck" />
                <div className="card-body">
                  <div className="card-title">
                    <span>Réserver une table chez Canard pour samedi</span>
                  </div>
                  <div className="card-meta">
                    <span className="chip">@ordi</span>
                    <span className="chip date today">Aujourd&apos;hui</span>
                  </div>
                  <div className="card-links">
                    <span className="chip link">Réserver sur TheFork</span>
                    <span className="chip link">Voir sur le plan</span>
                  </div>
                </div>
                <img className="mascot" src="/mascots/repas.webp" alt="" width={64} height={64} />
              </div>
              <div className="card has-mascot demo-card" style={{ animationDelay: '0.5s' }}>
                <span className="pbar" style={{ background: 'var(--c1)' }} />
                <span className="ck" />
                <div className="card-body">
                  <div className="card-title">
                    <span>Relancer François pour le devis</span>
                  </div>
                  <div className="card-meta">
                    <span className="chip proj" style={{ '--pc': 'var(--c1)' } as React.CSSProperties}>
                      <img src="/mascots/mascot-travail.webp" alt="" width={20} height={20} />
                      <span>Egyptours</span>
                    </span>
                    <span className="chip">@téléphone</span>
                    <span className="chip quick">2 min</span>
                  </div>
                </div>
                <img className="mascot" src="/mascots/appel.webp" alt="" width={64} height={64} />
              </div>
            </div>
          </div>
        </section>

        <section className="land-sec">
          <h2 className="land-h2">Comment ça marche</h2>
          <div className="land-steps">
            {STEPS.map(([n, t, d, img]) => (
              <div key={n} className="land-step">
                <img src={img} alt="" width={88} height={88} />
                <span className="ls-n">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="land-sec">
          <h2 className="land-h2">Un vrai facilitateur, pas une liste de plus</h2>
          <div className="land-grid">
            {FEATURES.map(([t, d]) => (
              <div key={t} className="land-feat">
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="land-sec land-gtd">
          <div>
            <h2 className="land-h2">La méthode GTD, sans la paperasse</h2>
            <p className="lede">
              Getting Things Done, la méthode de David Allen, tient en une idée : ta tête sert à avoir des idées, pas à les retenir. Tout ce que tu notes est capturé, clarifié en prochaine action, rangé, puis revu chaque semaine. Second Cerveau fait le tri à ta place.
            </p>
          </div>
          <img src="/mascots/mascot-sante.webp" alt="" width={160} height={160} />
        </section>

        <section className="land-final">
          <h2>Prêt à libérer ta tête ?</h2>
          <p className="lede">Crée ton compte, réponds à 5 questions, et ton espace est prêt.</p>
          <Link href={cta} className="btn primary lg">
            Créer mon compte gratuit
          </Link>
        </section>
      </main>

      <footer className="land-foot">
        <Logo size={28} />
        <span>Second Cerveau · Fait avec soin, en France</span>
        <Link href="/login">Se connecter</Link>
      </footer>
    </div>
  );
}
