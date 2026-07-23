import { Home, FileCheck, Library, Folder, Package, Clock, GitCompare, Calendar, LogOut, User, Users, Pencil, CalendarDays } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import logoPath from "@assets/Favicon Transparent_1764235508342.ico";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Project Library",
    url: "/projects",
    icon: Library,
  },
  {
    title: "Programmes",
    url: "/programmes",
    icon: Folder,
  },
  {
    title: "DCMA Assessment",
    url: "/dcma",
    icon: FileCheck,
  },
  {
    title: "Procurement Durations",
    url: "/procurement",
    icon: Package,
  },
  {
    title: "Live Procurement Dates",
    url: "/live-procurement",
    icon: Clock,
  },
  {
    title: "Live Design Dates",
    url: "/live-design",
    icon: Pencil,
  },
  {
    title: "Compare Programmes",
    url: "/compare",
    icon: GitCompare,
  },
  {
    title: "Holidays & Exceptions",
    url: "/exceptions",
    icon: Calendar,
  },
];

const settingsItems = [
  {
    title: "Manage Accounts",
    url: "/accounts",
    icon: Users,
  },
  {
    title: "Holiday Settings",
    url: "/holiday-settings",
    icon: CalendarDays,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <Sidebar>
      <SidebarContent>
        <div className="flex items-center justify-center border-b border-border p-3 min-h-[44px]">
          <div className="font-josefin font-semibold text-lg mt-2">Synergy Project Controls</div>
        </div>
        <SidebarGroup className="pt-6 mt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-2 mb-3 px-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground truncate">
              {user?.name || user?.username}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
        <div className="flex justify-center py-4">
          <img src={logoPath} alt="Synergy Logo" className="h-12 w-12" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
