import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
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
    { media: '(prefers-color-scheme: light)', color: '#fbfbfa' },
    { media: '(prefers-color-scheme: dark)', color: '#121315' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
