import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, ShoppingCart, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { isOwner, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    todaySales: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [productsRes, salesRes] = await Promise.all([
          supabase.from('products').select('quantity, low_stock_threshold'),
          supabase.from('sales').select('id, created_at')
        ]);

        const products = productsRes.data || [];
        const sales = salesRes.data || [];
        const today = new Date().toISOString().split('T')[0];
        const todaySales = sales.filter(sale => sale.created_at?.startsWith(today));

        setStats({
          totalProducts: products.length,
          lowStock: products.filter(p => p.quantity <= (p.low_stock_threshold || 10)).length,
          todaySales: todaySales.length
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (profile?.account_id) fetchStats();
  }, [profile]);

  // Stat card component for consistent styling
  const StatCard = ({ 
    title, 
    value, 
    icon, 
    color = "default",
    description 
  }: { 
    title: string; 
    value: string | number; 
    icon: React.ReactNode; 
    color?: "default" | "warning" | "success";
    description?: string;
  }) => (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-white to-gray-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg font-bold">{title}</CardTitle>
          {description && <CardDescription className="text-sm mt-1">{description}</CardDescription>}
        </div>
        <div className={`p-3 rounded-full ${color === 'warning' ? 'bg-orange-100 text-orange-600' : color === 'success' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-4xl font-bold ${color === 'warning' ? 'text-orange-600' : color === 'success' ? 'text-green-600' : 'text-blue-600'}`}>
          {loading ? '-' : value}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div className="text-center py-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Store Dashboard
        </h1>
        <p className="text-muted-foreground text-lg mt-2">
          Manage your inventory and business performance
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard 
          title="Total Products" 
          value={loading ? '-' : stats.totalProducts} 
          icon={<Package className="h-6 w-6" />}
          description="Items in inventory"
        />
        
        <StatCard 
          title="Low Stock Alerts" 
          value={loading ? '-' : stats.lowStock} 
          icon={<AlertTriangle className="h-6 w-6" />}
          color="warning"
          description="Items need restocking"
        />
        
        <StatCard 
          title="Today's Sales" 
          value={loading ? '-' : stats.todaySales} 
          icon={<ShoppingCart className="h-6 w-6" />}
          color="success"
          description="Transactions today"
        />
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Quick Actions</CardTitle>
          <CardDescription className="text-center">Manage your inventory efficiently</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div onClick={() => navigate('/products')} className="flex flex-col items-center p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow cursor-pointer">
              <div className="bg-blue-100 p-4 rounded-full mb-4">
                <Package className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Add New Product</h3>
              <p className="text-muted-foreground text-center mb-3">Quickly add items to your inventory</p>
              <Badge variant="secondary" className="text-sm">Quick Setup</Badge>
            </div>
            <div onClick={() => navigate('/sales')} className="flex flex-col items-center p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow cursor-pointer">
              <div className="bg-green-100 p-4 rounded-full mb-4">
                <ShoppingCart className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Record Sale</h3>
              <p className="text-muted-foreground text-center mb-3">Process sales transactions</p>
              <Badge variant="secondary" className="text-sm">2 taps</Badge>
            </div>
            <div onClick={() => navigate('/inventory')} className="flex flex-col items-center p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow cursor-pointer">
              <div className="bg-orange-100 p-4 rounded-full mb-4">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Check Low Stock</h3>
              <p className="text-muted-foreground text-center mb-3">Monitor inventory levels</p>
              <Badge variant="secondary" className="text-sm">Instant</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;