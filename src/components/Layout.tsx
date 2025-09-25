import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { 
  Home, 
  Package, 
  ShoppingCart, 
  BarChart3, 
  Users, 
  Settings,
  LogOut
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { memo } from 'react';

const ownerNavItems = [
  { title: 'Overview', icon: Home, href: '/' },
  { title: 'Products', icon: Package, href: '/products' },
  { title: 'Sales', icon: ShoppingCart, href: '/sales' },
  { title: 'Reports', icon: BarChart3, href: '/reports' },
  { title: 'Workers', icon: Users, href: '/workers' },
  { title: 'Settings', icon: Settings, href: '/settings' },
];

const workerNavItems = [
  { title: 'Overview', icon: Home, href: '/' },
  { title: 'Inventory', icon: Package, href: '/inventory' },
  { title: 'Sales', icon: ShoppingCart, href: '/sales' },
];

// Memoized Sidebar component to prevent unnecessary re-renders
const AppSidebar = memo(() => {
  const { isOwner, signOut, profile } = useAuth();
  const location = useLocation();
  
  const navItems = isOwner ? ownerNavItems : workerNavItems;

  return (
    <Sidebar className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-3 px-4 py-3 text-xl font-bold">
            <div className="bg-primary p-2 rounded-lg">
              <Package className="h-6 w-6 text-primary-foreground" />
            </div>
            <span>Inventro</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href} className="m-1">
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === item.href}
                    className="text-lg py-3 rounded-lg"
                  >
                    <Link to={item.href}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <div className="mt-auto p-4 space-y-3">
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            <div>Signed in as</div>
            <div className="font-medium text-foreground">{isOwner ? 'Store Owner' : 'Worker'}</div>
            <div className="truncate">{profile?.email}</div>
          </div>
          <Button 
            variant="outline" 
            size="lg" 
            onClick={signOut}
            className="w-full justify-start text-lg py-3"
          >
            <LogOut className="h-5 w-5 mr-2" />
            Sign Out
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
});

AppSidebar.displayName = 'AppSidebar';

export default function Layout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1">
          <div className="border-b p-4 bg-background">
            <SidebarTrigger className="h-10 w-10" />
          </div>
          <div className="p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}