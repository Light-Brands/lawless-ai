import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ToastProvider } from './components/Toast';
import MobileBottomNav from './components/MobileBottomNav';
import { AuthProvider } from './contexts/AuthContext';
import { ConversationProvider } from './contexts/ConversationContext';
import AuthGate from './components/AuthGate';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Lawless AI - Solution Architect',
  description: 'Your intelligent AI solution architect - bridging technical complexity and human understanding with clarity and precision',
  keywords: ['AI', 'solution architect', 'chat', 'code assistant', 'technical help'],
  authors: [{ name: 'Lawless AI' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#a855f7" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Lawless AI" />
        <meta name="application-name" content="Lawless AI" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#8B5CF6" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-152x152.png" />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css"
        />
      </head>
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
        <AuthProvider>
          <ConversationProvider>
            <AuthGate>
              <ToastProvider>
                {children}
                <MobileBottomNav />
              </ToastProvider>
            </AuthGate>
          </ConversationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
