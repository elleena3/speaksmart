import type { Metadata } from 'next';
import { AppLayout } from '@/components/app-layout';
import { LayoutDashboard, BookOpenCheck, Settings } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Teacher Dashboard | SpeakSmart Evaluator',
  description: 'Manage your assessments and students.',
};

const navItems = [
  { href: '/teacher/dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
  { href: '/teacher/assessments', label: 'Assessments', icon: <BookOpenCheck /> },
  { href: '/teacher/settings', label: 'Settings', icon: <Settings /> },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const title = "Teacher Portal";
  return <AppLayout navItems={navItems} title={title}>{children}</AppLayout>;
}
