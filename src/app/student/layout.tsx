import type { Metadata } from 'next';
import { AppLayout } from '@/components/app-layout';
import { LayoutDashboard, BookMarked, UserCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: '학생 대시보드 | SpeakSmart 평가도구',
  description: '말하기 연습, 평가 응시, 진행 상황 확인.',
};

const navItems = [
  { href: '/student/dashboard', label: '대시보드', icon: <LayoutDashboard /> },
  { href: '/student/history', label: '내 결과', icon: <BookMarked /> },
  { href: '/student/profile', label: '프로필', icon: <UserCircle /> },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const title = "학생 포털";
  return <AppLayout navItems={navItems} title={title}>{children}</AppLayout>;
}
