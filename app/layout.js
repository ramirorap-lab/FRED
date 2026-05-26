import { Big_Shoulders_Display, Barlow } from 'next/font/google';
import './globals.css';

const bigShoulders = Big_Shoulders_Display({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-display',
});

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-body',
});

export const metadata = {
  title: 'Fred — Your Film Friend',
  description: 'Find something worth watching tonight.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${bigShoulders.variable} ${barlow.variable}`}>
      <body>{children}</body>
    </html>
  );
}
