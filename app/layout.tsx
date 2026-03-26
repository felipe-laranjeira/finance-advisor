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
  title: 'Fiscal Atelier | Gestão de Patrimônio Premium',
  description: 'Acompanhamento abrangente de suas saídas fiscais e compromissos.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${manrope.variable}`}>
      <body suppressHydrationWarning className="bg-[#f7f9fc] text-[#191c1e] antialiased">
        {children}
      </body>
    </html>
  );
}
