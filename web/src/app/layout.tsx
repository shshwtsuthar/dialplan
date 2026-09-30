import type { Metadata } from 'next';
import { Karla } from 'next/font/google';
import type { ReactNode } from 'react';
import { DEFAULT_TIMEZONE } from '@/lib/config';
import { SUNRISE, SUNSET } from '@/lib/theme';
import './globals.css';

const karla = Karla({ subsets: ['latin'], variable: '--font-karla' });

export const metadata: Metadata = {
  title: 'Harbor Auto · Call routing',
  description: 'Where should this call ring? A call-routing decision service, with the web page playing the phone switch.',
};

// Runs before the first paint, so the page opens in the theme for the time in
// San Diego instead of flashing from light to dark. The clock takes over after.
const themeScript = `try{var h=+new Intl.DateTimeFormat('en-US',{timeZone:'${DEFAULT_TIMEZONE}',hour:'numeric',hourCycle:'h23'}).format(new Date());document.documentElement.dataset.theme=h>=${SUNRISE}&&h<${SUNSET}?'light':'dark'}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={karla.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-sm text-foreground antialiased">{children}</body>
    </html>
  );
}
