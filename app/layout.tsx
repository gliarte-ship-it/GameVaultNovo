import type { Metadata } from 'next';
import { Space_Grotesk, Manrope } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['300', '400', '500', '600', '700'],
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'GameVault',
  description: 'Seu rastreador de jogos de última geração',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GameVault',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${spaceGrotesk.variable} ${manrope.variable} dark`}>
      <body suppressHydrationWarning className="bg-surface text-on-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
