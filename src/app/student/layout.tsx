import type { Metadata } from 'next';
import { AppLayout } from '@/components/app-layout';
import { LayoutDashboard, BookMarked, UserCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Student Dashboard | SpeakSmart Evaluator',
  description: 'Practice speaking, take assessments, and view your progress.',
};

const navItems = [
  { href: '/student/dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
  { href: '/student/history', label: 'My Results', icon: <BookMarked /> },
  { href: '/student/profile', label: 'Profile', icon: <UserCircle /> },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const title = "Student Portal";
  return <AppLayout navItems={navItems} title={title}>{children}</AppLayout>;
}
