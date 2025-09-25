import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Download, TrendingUp, Package, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SalesReport {
  date: string;
  total_sales: number;
  total_quantity: number;
  total_gst: number;
  transaction_count: number;
}

interface ProductSales {
  product_name: string;
  total_quantity: number;
  total_revenue: number;
}

export default function Reports() {
  const { isOwner } = useAuth();
  const { toast } = useToast();
  const [salesData, setSalesData] = useState<SalesReport[]>([]);
  const [productSales, setProductSales] = useState<ProductSales[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Pagination states for sales data
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Memoize filtered and paginated sales data
  const paginatedSalesData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return salesData.slice(startIndex, startIndex + itemsPerPage);
  }, [salesData, currentPage]);

  const fetchReports = async () => {
    try {
      let dateFilter = '';
      
      if (dateRange === 'custom' && startDate && endDate) {
        dateFilter = `created_at.gte.${startDate} AND created_at.lte.${endDate}`;
      } else {
        const days = parseInt(dateRange);
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        dateFilter = `created_at.gte.${fromDate.toISOString()}`;
      }

      // Fetch sales data with date filter
      const { data: fallbackSales, error: fallbackError } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (fallbackError) throw fallbackError;
      
      // Group by date
      const grouped = fallbackSales?.reduce((acc: any, sale) => {
        const date = sale.created_at.split('T')[0];
        if (!acc[date]) {
          acc[date] = {
            date,
            total_sales: 0,
            total_quantity: 0,
            total_gst: 0,
            transaction_count: 0
          };
        }
        acc[date].total_sales += sale.total_price;
        acc[date].total_quantity += sale.quantity;
        acc[date].total_gst += sale.gst_amount;
        acc[date].transaction_count += 1;
        return acc;
      }, {});
      
      setSalesData(Object.values(grouped || {}) as SalesReport[]);

      // Fetch product sales summary
      const { data: productData, error: productError } = await supabase
        .from('sales')
        .select(`
          quantity,
          total_price,
          products(name)
        `)
        .order('created_at', { ascending: false });

      if (productError) throw productError;

      // Group product sales
      const productSummary = productData?.reduce((acc: any, sale) => {
        const productName = sale.products?.name || 'Unknown Product';
        if (!acc[productName]) {
          acc[productName] = {
            product_name: productName,
            total_quantity: 0,
            total_revenue: 0
          };
        }
        acc[productName].total_quantity += sale.quantity;
        acc[productName].total_revenue += sale.total_price;
        return acc;
      }, {});

      setProductSales(Object.values(productSummary || {}));

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching reports",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange, startDate, endDate]);

  const exportToCSV = (data: any[], filename: string) => {
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Memoize calculated totals
  const totalRevenue = useMemo(() => 
    salesData.reduce((sum, day) => sum + (day.total_sales || 0), 0), 
    [salesData]
  );
  
  const totalTransactions = useMemo(() => 
    salesData.reduce((sum, day) => sum + (day.transaction_count || 0), 0), 
    [salesData]
  );
  
  const totalQuantity = useMemo(() => 
    salesData.reduce((sum, day) => sum + (day.total_quantity || 0), 0), 
    [salesData]
  );

  // Handle page change
  const totalPages = Math.ceil(salesData.length / itemsPerPage);
  
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (!isOwner) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Sales analytics and business insights</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => exportToCSV(salesData, 'sales-report')}
            disabled={salesData.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Sales
          </Button>
          <Button 
            variant="outline" 
            onClick={() => exportToCSV(productSales, 'product-sales-report')}
            disabled={productSales.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Products
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Units Sold</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuantity}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Transaction</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{totalTransactions > 0 ? (totalRevenue / totalTransactions).toFixed(2) : '0.00'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="dateRange">Date Range</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {dateRange === 'custom' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Sales</CardTitle>
            <CardDescription>Revenue breakdown by day (Page {currentPage} of {totalPages})</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Transactions</TableHead>
                      <TableHead>Units</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSalesData.map((day, index) => (
                      <TableRow key={index}>
                        <TableCell>{new Date(day.date).toLocaleDateString()}</TableCell>
                        <TableCell>₹{day.total_sales?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell>{day.transaction_count || 0}</TableCell>
                        <TableCell>{day.total_quantity || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => handlePageChange(currentPage - 1)}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        
                        {/* First page */}
                        <PaginationItem>
                          <PaginationLink 
                            onClick={() => handlePageChange(1)}
                            isActive={currentPage === 1}
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                        
                        {/* Ellipsis for skipped pages at the start */}
                        {currentPage > 3 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        
                        {/* Pages around current page */}
                        {Array.from({ length: Math.min(3, totalPages - 2) }, (_, i) => {
                          const page = currentPage - 1 + i;
                          if (page > 1 && page < totalPages) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink 
                                  onClick={() => handlePageChange(page)}
                                  isActive={currentPage === page}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          }
                          return null;
                        })}
                        
                        {/* Ellipsis for skipped pages at the end */}
                        {currentPage < totalPages - 2 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        
                        {/* Last page */}
                        {totalPages > 1 && (
                          <PaginationItem>
                            <PaginationLink 
                              onClick={() => handlePageChange(totalPages)}
                              isActive={currentPage === totalPages}
                            >
                              {totalPages}
                            </PaginationLink>
                          </PaginationItem>
                        )}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => handlePageChange(currentPage + 1)}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Performance</CardTitle>
            <CardDescription>Top selling products</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : productSales.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No product sales data available.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Units Sold</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productSales
                    .sort((a, b) => b.total_revenue - a.total_revenue)
                    .slice(0, 10)
                    .map((product, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{product.product_name}</TableCell>
                        <TableCell>{product.total_quantity}</TableCell>
                        <TableCell>₹{product.total_revenue.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}