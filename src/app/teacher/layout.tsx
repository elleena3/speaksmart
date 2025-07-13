import type { Metadata } from 'next';
import { AppLayout } from '@/components/app-layout';
import { LayoutDashboard, BookOpenCheck, Settings } from 'lucide-react';

export const metadata: Metadata = {
  title: '교사 대시보드 | SpeakSmart 평가도구',
  description: '평가 및 학생 관리.',
};

const navItems = [
  { href: '/teacher/dashboard', label: '대시보드', icon: <LayoutDashboard /> },
  { href: '/teacher/assessments', label: '평가', icon: <BookOpenCheck /> },
  { href: '/teacher/settings', label: '설정', icon: <Settings /> },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const title = "교사 포털";
  return <AppLayout navItems={navItems} title={title}>{children}</AppLayout>;
}
