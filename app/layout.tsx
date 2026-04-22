import type { Metadata } from 'next';
import { Inter, Manrope } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-headline',
});

export const metadata: Metadata = {
  title: 'Financial Advisor | O seu assistente financeiro',
  description: 'Acompanhamento abrangente de suas saídas fiscais e compromissos.',
};

import { AuthProvider } from '@/components/AuthProvider';
import { BottomNavbar } from '@/components/BottomNavbar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${manrope.variable}`}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
      </head>
      <body suppressHydrationWarning className="bg-[#f7f9fc] text-[#191c1e] antialiased pb-20 lg:pb-0">
        <AuthProvider>
          {children}
          <BottomNavbar />
        </AuthProvider>
      </body>
    </html>
  );
}
