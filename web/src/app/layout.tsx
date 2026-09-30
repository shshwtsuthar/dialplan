import type { Metadata, Viewport } from 'next';
import { Karla } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const karla = Karla({ subsets: ['latin'], variable: '--font-karla' });

export const metadata: Metadata = {
  title: 'Harbor Auto · Call routing',
  description: 'Where should this call ring? A call-routing decision service, with the web page playing the phone switch.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eceff1' },
    { media: '(prefers-color-scheme: dark)', color: '#111619' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={karla.variable}>
      <body className="min-h-screen bg-background font-sans text-sm text-foreground antialiased">{children}</body>
    </html>
  );
}
