import type { Metadata } from 'next';
import { AppLayout } from '@/components/app-layout';
import { LayoutDashboard, BookMarked, UserCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: '학생 대시보드 | SpeakSmart 평가도구',
  description: '말하기 연습, 평가 응시, 진행 상황 확인.',
};

const navItems = [
  { href: '/student/dashboard', labelKey: 'dashboard' as const, icon: <LayoutDashboard /> },
  { href: '/student/history', labelKey: 'myResults' as const, icon: <BookMarked /> },
  { href: '/student/profile', labelKey: 'profile' as const, icon: <UserCircle /> },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const titleKey = "studentPortal";
  return <AppLayout navItems={navItems} titleKey={titleKey}>{children}</AppLayout>;
}
