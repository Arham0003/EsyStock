import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Plus, ShoppingCart, Package } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  quantity: number;
  selling_price: number;
  gst: number;
}

interface Sale {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  gst_amount: number | null;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  products: {
    name: string;
  };
} // @ts-ignore - customer fields will be added by migration

export default function Sales() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Array<{id: string, quantity: number}>>([]);
  const [currentProduct, setCurrentProduct] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState(1);
  // Customer details state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSales, setTotalSales] = useState(0);
  const itemsPerPage = 10;

  const fetchData = async () => {
    try {
      // Fetch products (all products with stock)
      const productsRes = await supabase.from('products').select('id, name, quantity, selling_price, gst').gt('quantity', 0);
      
      if (productsRes.error) throw productsRes.error;
      setProducts(productsRes.data || []);

      // Fetch sales with pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      let salesData: Sale[] = [];
      let totalCount = 0;
      
      try {
        // First, try to select with customer fields
        const result = await supabase
          .from('sales')
          .select(`
            id, product_id, quantity, unit_price, total_price, gst_amount, created_at,
            customer_name, customer_phone,
            products(name)
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);

        if (result.error) {
          throw result.error;
        }

        // Use unknown for type assertion to avoid TypeScript errors
        salesData = result.data as unknown as Sale[];
        totalCount = result.count || 0;
      } catch (error: any) {
        // If there's an error (likely due to missing columns), fall back to basic select
        if (error.message && (error.message.includes('customer_name') || error.message.includes('column'))) {
          console.log('Customer fields not found, falling back to basic select');
          
          const fallbackRes = await supabase
            .from('sales')
            .select(`
              id, product_id, quantity, unit_price, total_price, gst_amount, created_at,
              products(name)
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);
            
          if (fallbackRes.data) {
            // Transform data to include optional customer fields
            salesData = fallbackRes.data.map(sale => ({
              ...sale,
              customer_name: null,
              customer_phone: null
            })) as unknown as Sale[];
            totalCount = fallbackRes.count || 0;
          }
        } else {
          // For other errors, re-throw
          throw error;
        }
      }
      
      setSales(salesData);
      setTotalSales(totalCount);

      // Remove duplicate processing of salesRes as it's not defined
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching data",
        description: error.message.includes('customer_name') || error.message.includes('column') 
          ? "The database needs to be updated to support customer information. Please ask your administrator to apply the required database migration from the Supabase dashboard." 
          : error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage]);

  const handleAddToCart = () => {
    if (!currentProduct) {
      toast({
        variant: "destructive",
        title: "Please select a product",
      });
      return;
    }

    const product = products.find(p => p.id === currentProduct);
    if (!product) {
      toast({
        variant: "destructive",
        title: "Product not found",
      });
      return;
    }

    if (currentQuantity > product.quantity) {
      toast({
        variant: "destructive",
        title: "Insufficient stock",
        description: `Only ${product.quantity} units available`,
      });
      return;
    }

    // Check if product already in cart
    const existingIndex = selectedProducts.findIndex(p => p.id === currentProduct);
    if (existingIndex >= 0) {
      // Update quantity if adding more would exceed stock
      const updatedProducts = [...selectedProducts];
      const newQuantity = updatedProducts[existingIndex].quantity + currentQuantity;
      if (newQuantity > product.quantity) {
        toast({
          variant: "destructive",
          title: "Insufficient stock",
          description: `Only ${product.quantity} units available, you already have ${updatedProducts[existingIndex].quantity} in cart`,
        });
        return;
      }
      updatedProducts[existingIndex].quantity = newQuantity;
      setSelectedProducts(updatedProducts);
    } else {
      setSelectedProducts([...selectedProducts, { id: currentProduct, quantity: currentQuantity }]);
    }

    // Reset current selection
    setCurrentProduct('');
    setCurrentQuantity(1);
  };

  const handleRemoveFromCart = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) return;
    
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    if (newQuantity > product.quantity) {
      toast({
        variant: "destructive",
        title: "Insufficient stock",
        description: `Only ${product.quantity} units available`,
      });
      return;
    }
    
    setSelectedProducts(selectedProducts.map(p => 
      p.id === productId ? { ...p, quantity: newQuantity } : p
    ));
  };

  const handleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedProducts.length === 0) {
      toast({
        variant: "destructive",
        title: "Please add at least one product to cart",
      });
      return;
    }

    try {
      // Create sales records for each item in the cart
      let salesToInsert = selectedProducts.map(item => {
        const product = products.find(p => p.id === item.id);
        if (!product) {
          throw new Error(`Product with id ${item.id} not found`);
        }
        
        const unitPrice = product.selling_price;
        const subtotal = unitPrice * item.quantity;
        const gstAmount = (subtotal * product.gst) / 100;
        const totalPrice = subtotal + gstAmount;
        
        return {
          account_id: profile?.account_id,
          product_id: item.id,
          user_id: profile?.id,
          quantity: item.quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          gst_amount: gstAmount,
          // Add customer details
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
        };
      });
      
      let { error } = await supabase.from('sales').insert(salesToInsert);

      // If there's an error due to missing columns, try again without customer fields
      if (error && error.message && (error.message.includes('customer_name') || error.message.includes('column'))) {
        console.log('Customer fields not found, trying without customer fields');
        const fallbackSalesToInsert = salesToInsert.map(sale => {
          const { customer_name, customer_phone, ...rest } = sale;
          return rest;
        });
        
        const fallbackResult = await supabase.from('sales').insert(fallbackSalesToInsert);
        error = fallbackResult.error;
        
        // If the fallback also fails, show a more specific error message
        if (error) {
          throw new Error("The database needs to be updated to support customer information. Please contact your administrator to apply the required database migration.");
        } else {
          // If fallback succeeds, show a warning that customer info wasn't saved
          toast({
            title: "Sale recorded",
            description: `Sale of ${selectedProducts.length} item(s) recorded successfully${customerName ? ' for ' + customerName : ''}. Note: Customer information could not be saved due to missing database columns.`,
          });
        }
      } else if (error) {
        // Some other error occurred
        throw error;
      } else {
        // Success with customer info
        toast({
          title: "Sale recorded",
          description: `Sale of ${selectedProducts.length} item(s) recorded successfully${customerName ? ' for ' + customerName : ''}`,
        });
      }

      setIsDialogOpen(false);
      setSelectedProducts([]);
      setCurrentProduct('');
      setCurrentQuantity(1);
      // Reset customer details
      setCustomerName('');
      setCustomerPhone('');
      // Refresh data after recording sale
      fetchData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error recording sale",
        description: error.message.includes('customer_name') || error.message.includes('column') 
          ? "The database needs to be updated to support customer information. Please ask your administrator to apply the required database migration from the Supabase dashboard." 
          : error.message,
      });
    }
  };

  // Calculate pagination values
  const totalPages = Math.ceil(totalSales / itemsPerPage);
  
  // Memoize calculated values
  // Calculate totals for all selected products
  const orderTotals = useMemo(() => {
    let subtotal = 0;
    let gstAmount = 0;
    let grandTotal = 0;

    selectedProducts.forEach(item => {
      const product = products.find(p => p.id === item.id);
      if (product) {
        const itemSubtotal = product.selling_price * item.quantity;
        const itemGstAmount = (itemSubtotal * product.gst) / 100;
        subtotal += itemSubtotal;
        gstAmount += itemGstAmount;
        grandTotal += itemSubtotal + itemGstAmount;
      }
    });

    return { subtotal, gstAmount, grandTotal };
  }, [selectedProducts, products]);

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setLoading(true);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
            Sales Management
          </h1>
          <p className="text-muted-foreground text-lg mt-2">
            Record and manage sales transactions
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="text-lg py-3 px-6 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Record Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto w-[95vw]">
            <DialogHeader>
              <DialogTitle className="text-2xl">Record New Sale</DialogTitle>
              <DialogDescription className="text-lg">
                Select a product and quantity to record the sale
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSale} className="space-y-6">
              {/* Cart Items Display */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-lg font-medium">Cart Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentProduct('');
                      setCurrentQuantity(1);
                    }}
                    className="text-sm"
                  >
                    Clear All
                  </Button>
                </div>
                
                {selectedProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Your cart is empty</p>
                    <p className="text-sm">Add products using the form below</p>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-white p-4 space-y-3 max-h-60 overflow-y-auto">
                    {selectedProducts.map((item) => {
                      const product = products.find(p => p.id === item.id);
                      if (!product) return null;
                      
                      const itemSubtotal = product.selling_price * item.quantity;
                      const itemGstAmount = (itemSubtotal * product.gst) / 100;
                      const itemTotal = itemSubtotal + itemGstAmount;
                      
                      return (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <div className="flex-1">
                            <div className="font-medium text-lg">{product.name}</div>
                            <div className="text-sm text-muted-foreground">
                              ₹{product.selling_price} × {item.quantity} = ₹{itemSubtotal.toFixed(2)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <div className="text-right">
                              <div className="font-medium">₹{itemTotal.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">incl. GST</div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleRemoveFromCart(item.id)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Add Product to Cart Form */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium">Add Product</h3>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currentProduct" className="text-sm font-medium">Product</Label>
                    <Select value={currentProduct} onValueChange={setCurrentProduct}>
                      <SelectTrigger className="py-2 px-3">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id} className="py-2">
                            <div className="flex justify-between w-full">
                              <span>{product.name}</span>
                              <span className="text-muted-foreground text-sm">Stock: {product.quantity}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currentQuantity" className="text-sm font-medium">Quantity</Label>
                    <Input
                      id="currentQuantity"
                      type="number"
                      min="1"
                      max={currentProduct ? products.find(p => p.id === currentProduct)?.quantity : 1}
                      value={currentQuantity}
                      onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)}
                      className="py-2 px-3"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
              </div>

              {/* Customer Details Form */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium">Customer Information</h3>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="customerName" className="text-sm font-medium">Name</Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter customer name"
                      className="py-2 px-3 w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerPhone" className="text-sm font-medium">Phone</Label>
                    <Input
                      id="customerPhone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Enter phone number"
                      type="tel"
                      className="py-2 px-3 w-full"
                    />
                  </div>
                </div>
              </div>
              
              {/* Order Summary */}
              {selectedProducts.length > 0 && (
                <Card className="space-y-4 p-6 bg-gradient-to-br from-gray-50 to-white border-0 shadow-md">
                  <h3 className="text-xl font-bold">Order Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-lg">
                      <span>Items ({selectedProducts.length}):</span>
                      <span>{selectedProducts.reduce((sum, item) => sum + item.quantity, 0)} units</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span>Subtotal:</span>
                      <span>₹{orderTotals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span>GST:</span>
                      <span>₹{orderTotals.gstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xl border-t pt-3 mt-2">
                      <span>Total:</span>
                      <span className="text-green-600">₹{orderTotals.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </Card>
              )}
              
              <div className="flex gap-4 pt-2">
                <Button 
                  type="submit" 
                  disabled={selectedProducts.length === 0}
                  className="flex-1 text-lg py-3 px-6 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Record Sale
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsDialogOpen(false);
                    // Reset all form fields
                    setSelectedProducts([]);
                    setCurrentProduct('');
                    setCurrentQuantity(1);
                    setCustomerName('');
                    setCustomerPhone('');
                  }} 
                  className="flex-1 text-lg py-3 px-6"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-xl border-0 bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Recent Sales</CardTitle>
              <CardDescription className="text-lg mt-1">
                Latest sales transactions (Page {currentPage} of {totalPages})
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-4 text-muted-foreground text-lg">Loading sales...</p>
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-100 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <ShoppingCart className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold mb-2">No Sales Recorded</h3>
              <p className="text-muted-foreground text-lg mb-6">
                Start recording sales transactions
              </p>
              <Button 
                onClick={() => setIsDialogOpen(true)} 
                className="text-lg py-3 px-8 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Record Your First Sale
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border-0 bg-white shadow-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-gradient-to-r from-green-50 to-teal-50">
                    <TableRow>
                      <TableHead className="text-lg font-bold text-gray-700 py-4">Product</TableHead>
                      <TableHead className="text-lg font-bold text-gray-700 py-4">Quantity</TableHead>
                      <TableHead className="text-lg font-bold text-gray-700 py-4">Unit Price</TableHead>
                      <TableHead className="text-lg font-bold text-gray-700 py-4">GST</TableHead>
                      <TableHead className="text-lg font-bold text-gray-700 py-4">Total</TableHead>
                      <TableHead className="text-lg font-bold text-gray-700 py-4">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow 
                        key={sale.id} 
                        className="hover:bg-green-50 transition-colors"
                      >
                        <TableCell className="font-medium text-lg py-4">{sale.products?.name}</TableCell>
                        <TableCell className="text-lg py-4">{sale.quantity}</TableCell>
                        <TableCell className="text-lg py-4">₹{sale.unit_price}</TableCell>
                        <TableCell className="text-lg py-4">₹{sale.gst_amount?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell className="text-lg py-4 font-bold text-green-600">₹{sale.total_price.toFixed(2)}</TableCell>
                        <TableCell className="text-lg py-4">{new Date(sale.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="mt-8">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => handlePageChange(currentPage - 1)}
                          className={`${currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} text-lg py-2 px-4`}
                        />
                      </PaginationItem>
                      
                      {/* First page */}
                      <PaginationItem>
                        <PaginationLink 
                          onClick={() => handlePageChange(1)}
                          isActive={currentPage === 1}
                          className="text-lg py-2 px-4"
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      
                      {/* Ellipsis for skipped pages at the start */}
                      {currentPage > 3 && (
                        <PaginationItem>
                          <PaginationEllipsis className="text-lg" />
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
                                className="text-lg py-2 px-4"
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
                          <PaginationEllipsis className="text-lg" />
                        </PaginationItem>
                      )}
                      
                      {/* Last page */}
                      {totalPages > 1 && (
                        <PaginationItem>
                          <PaginationLink 
                            onClick={() => handlePageChange(totalPages)}
                            isActive={currentPage === totalPages}
                            className="text-lg py-2 px-4"
                          >
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      )}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => handlePageChange(currentPage + 1)}
                          className={`${currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} text-lg py-2 px-4`}
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
    </div>
  );
}