"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Logo } from "@/components/icons"
import { Button } from "./ui/button"
import { LogOut, Globe } from "lucide-react"
import { useLanguage } from "@/context/language-context"
import { translations } from "@/lib/locales"

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
  const { language, setLanguage, t } = useLanguage()

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <Globe/>
                  <span>{t.language.title}</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem onClick={() => setLanguage('ko')} disabled={language === 'ko'}>
                  한국어
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('en')} disabled={language === 'en'}>
                  English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          <Link href="/" passHref>
             <SidebarMenuButton>
                <LogOut/>
                <span>{t.nav.logout}</span>
             </SidebarMenuButton>
          </Link>
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
