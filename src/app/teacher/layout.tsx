
import type { Metadata } from 'next';
import { AppLayout } from '@/components/app-layout';
import { LayoutDashboard, BookOpenCheck, Settings, FlaskConical } from 'lucide-react';

export const metadata: Metadata = {
  title: '교사 대시보드 | SpeakSmart 평가도구',
  description: '평가 및 학생 관리.',
};

const navItems = [
  { href: '/teacher/dashboard', labelKey: 'dashboard' as const, icon: <LayoutDashboard /> },
  { href: '/teacher/assessments', labelKey: 'assessments' as const, icon: <BookOpenCheck /> },
  { href: '/teacher/settings', labelKey: 'settings' as const, icon: <Settings /> },
  { href: '/teacher/misc', labelKey: 'misc' as const, icon: <FlaskConical /> },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const titleKey = "teacherPortal";
  return <AppLayout navItems={navItems} titleKey={titleKey}>{children}</AppLayout>;
}
