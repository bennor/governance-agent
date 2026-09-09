"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Plus, MessageSquare, LayoutDashboard, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PortalNavigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Cases Dashboard", icon: LayoutDashboard },
    { href: "/cases/new", label: "New Governance Case", icon: Plus },
    { href: "/chat", label: "Direct Agent Chat", icon: MessageSquare },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-sm">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <ShieldCheck className="size-4" />
            </div>
            <span className="tracking-tight text-base font-bold">Release Governance</span>
            <Badge variant="outline" className="hidden text-[10px] font-normal sm:inline-flex">
              Eve Agent
            </Badge>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/cases/new">
            <Button size="sm" className="h-8 gap-1.5 text-xs shadow-xs">
              <Plus className="size-3.5" />
              <span>Intake Change</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
