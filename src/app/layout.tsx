import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from '@/context/language-context';
import { AuthProvider } from '@/context/auth-context';
import { Noto_Sans_KR } from 'next/font/google';

const noto_sans_kr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal'],
  variable: '--font-noto-sans-kr',
});

export const metadata: Metadata = {
  title: 'SpeakSmart 평가도구',
  description: 'AI 기반 영어 말하기 평가 플랫폼',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${noto_sans_kr.variable} font-body antialiased bg-saebyeol-beige text-basalt-gray`}>
        <AuthProvider>
          <LanguageProvider>
            {children}
            <Toaster />
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
