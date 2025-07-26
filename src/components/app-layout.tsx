
"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter
} from "@/components/ui/sidebar"
import { Logo } from "@/components/icons"
import { LogOut } from "lucide-react"
import { useLanguage } from "@/context/language-context"
import { translations } from "@/lib/locales"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar"

type NavItem = {
  href: string
  labelKey: keyof (typeof translations.ko.nav);
  icon: React.ReactNode
}

type AppLayoutProps = {
  children: React.ReactNode
  navItems: NavItem[]
  titleKey: keyof typeof translations.ko.titles;
}

export function AppLayout({ children, navItems, titleKey }: AppLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const { toast } = useToast()

  const handleLogout = async () => {
    await logout();
    router.push('/');
    toast({ title: "로그아웃", description: "성공적으로 로그아웃되었습니다." });
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link href="/" className="flex items-center gap-2">
            <Logo className="size-7 text-primary" />
            <h1 className="text-xl font-semibold font-headline">SpeakSmart</h1>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    tooltip={{ children: t.nav[item.labelKey], side: "right" }}
                  >
                    {item.icon}
                    <span>{t.nav[item.labelKey]}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-3 p-2">
             <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "User"}/>
                <AvatarFallback>{user?.displayName?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">{user?.displayName}</span>
                <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
            </div>
          </div>
          <SidebarMenuButton onClick={handleLogout}>
            <LogOut/>
            <span>{t.nav.logout}</span>
          </SidebarMenuButton>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center justify-between p-4 border-b bg-card md:bg-transparent">
          <div className="md:hidden">
             <SidebarTrigger />
          </div>
          <h2 className="text-xl font-semibold font-headline ml-4 md:ml-0">{t.titles[titleKey]}</h2>
          <div className="hidden md:block">
            <SidebarTrigger />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
