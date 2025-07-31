
import type { Metadata } from 'next';
import { AppLayout } from '@/components/app-layout';
import { LayoutDashboard, BookOpenCheck, Users, Settings, FlaskConical, DraftingCompass, MessageSquare } from 'lucide-react';

export const metadata: Metadata = {
  title: '교사 대시보드 | SpeakSmart 평가도구',
  description: '평가 및 학생 관리.',
};

const navItems = [
  { href: '/teacher/dashboard', labelKey: 'dashboard' as const, icon: <LayoutDashboard /> },
  { href: '/teacher/assessments', labelKey: 'assessments' as const, icon: <BookOpenCheck /> },
  { href: '/teacher/rubrics', labelKey: 'rubrics' as const, icon: <DraftingCompass /> },
  { href: '/teacher/students', labelKey: 'students' as const, icon: <Users /> },
  { href: '/teacher/conversation-tools', labelKey: 'conversationTools' as const, icon: <MessageSquare /> },
  { href: '/teacher/misc', labelKey: 'misc' as const, icon: <FlaskConical /> },
  { href: '/teacher/settings', labelKey: 'settings' as const, icon: <Settings /> },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const titleKey = "teacherPortal";
  return <AppLayout navItems={navItems} titleKey={titleKey}>{children}</AppLayout>;
}
