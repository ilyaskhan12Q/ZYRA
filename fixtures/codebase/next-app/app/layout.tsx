import React from 'react';
import './globals.css';
import { Header } from '../components/Header';

export const metadata = {
  title: 'Synthetic Next.js App',
  description: 'Test fixture for ZYRA Phase 04',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
