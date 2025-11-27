import { Home, FileCheck, Library, Folder, Package, GitCompare, Calendar } from "lucide-react";
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

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-josefin font-semibold text-lg py-4 px-4 w-full">Synergy Project Controls</SidebarGroupLabel>
          <SidebarGroupContent className="mt-6 pt-6 border-t border-border">
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}>
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
        <div className="flex justify-center py-4">
          <img src={logoPath} alt="Synergy Logo" className="h-12 w-12" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
