import type { Metadata, Viewport } from 'next';
import '@fontsource/lexend/latin-300.css';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-500.css';
import '@fontsource/lexend/latin-600.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Second Cerveau',
  description: "Tu notes, l'IA range. Projets, journée, semaine et mois au même endroit, selon la méthode Getting Things Done.",
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Second Cerveau', statusBarStyle: 'default' },
  icons: { icon: '/icon.svg', apple: '/apple-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4FAFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0D1626' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
