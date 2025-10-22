import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Plus, ShoppingCart, Package, Eye, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

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

interface Settings {
  gst_enabled: boolean;
  default_gst_rate: number;
}

export default function Sales() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
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
  const [productSearchTerm, setProductSearchTerm] = useState('');
  // Sales detail modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [productPrices, setProductPrices] = useState<Record<string, number>>({});
  
  // Mobile detection
  const isMobile = useIsMobile();
  
  // Filter products based on search term
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return products;
    
    return products.filter(product => 
      product.name.toLowerCase().includes(productSearchTerm.toLowerCase())
    );
  }, [products, productSearchTerm]);

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

  // Add a separate effect to fetch settings when profile changes
  useEffect(() => {
    const fetchSettings = async () => {
      if (!profile?.account_id) return;
      
      try {
        const settingsRes = await supabase
          .from('settings')
          .select('gst_enabled, default_gst_rate')
          .eq('account_id', profile.account_id)
          .single();
        
        if (!settingsRes.error) {
          setSettings(settingsRes.data);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    
    fetchSettings();
    
    // Subscribe to settings changes
    const settingsSubscription = supabase
      .channel('settings-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'settings',
          filter: `account_id=eq.${profile?.account_id}`
        },
        (payload) => {
          setSettings(payload.new as Settings);
        }
      )
      .subscribe();
    
    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(settingsSubscription);
    };
  }, [profile?.account_id]);

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

    // Check if a custom price has been set, otherwise use the product's selling price
    const currentPrice = productPrices[currentProduct] || product.selling_price;

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
    // Reset search term
    setProductSearchTerm('');
    // Note: We don't reset the custom price here because it's needed for the cart calculation
    // The price will be used when the item is in the cart and will be cleared when the sale is recorded
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
      // Fetch the latest settings to ensure we're using current GST settings
      const settingsRes = await supabase
        .from('settings')
        .select('gst_enabled, default_gst_rate')
        .eq('account_id', profile?.account_id)
        .single();
      
      if (settingsRes.error) throw settingsRes.error;
      const currentSettings = settingsRes.data;

      // Create sales records for each item in the cart
      let salesToInsert = selectedProducts.map(item => {
        const product = products.find(p => p.id === item.id);
        if (!product) {
          throw new Error(`Product with id ${item.id} not found`);
        }
        
        // Use custom price if set, otherwise use product's selling price
        const unitPrice = productPrices[item.id] || product.selling_price;
        const subtotal = unitPrice * item.quantity;
        
        // Check if GST is enabled before calculating
        const gstAmount = currentSettings?.gst_enabled 
          ? (subtotal * currentSettings.default_gst_rate) / 100 
          : 0;
          
        const totalPrice = subtotal + gstAmount;
        
        return {
          account_id: profile?.account_id,
          product_id: item.id,
          user_id: profile?.id,
          quantity: item.quantity,
          unit_price: unitPrice, // Use the custom price
          total_price: totalPrice,
          gst_amount: gstAmount,
          // Add customer details - use "Walk-in Customer" if name is empty
          customer_name: customerName || "Walk-in Customer",
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
  // Calculate totals for all selected products (updated to use custom prices and global GST settings)
  const orderTotals = useMemo(() => {
    let subtotal = 0;
    let gstAmount = 0;
    let grandTotal = 0;

    selectedProducts.forEach(item => {
      const product = products.find(p => p.id === item.id);
      if (product) {
        // Use custom price if set, otherwise use product's selling price
        const unitPrice = productPrices[item.id] || product.selling_price;
        const itemSubtotal = unitPrice * item.quantity;
        
        // Check if GST is enabled before calculating
        const itemGstAmount = settings?.gst_enabled 
          ? (itemSubtotal * settings.default_gst_rate) / 100 
          : 0;
          
        subtotal += itemSubtotal;
        gstAmount += itemGstAmount;
        grandTotal += itemSubtotal + itemGstAmount;
      }
    });

    return { subtotal, gstAmount, grandTotal };
  }, [selectedProducts, products, productPrices, settings]);

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setLoading(true);
    }
  };

  // Function to show sale details in modal
  const showSaleDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailModalOpen(true);
  };

  // Function to download sale details as text
  const downloadSaleDetails = () => {
    if (!selectedSale) return;
    
    const saleDate = new Date(selectedSale.created_at).toLocaleString();
    const customerName = selectedSale.customer_name || "Walk-in Customer";
    const customerPhone = selectedSale.customer_phone || "Not provided";
    
    const content = `
SALE RECEIPT
====================
Date: ${saleDate}
Product: ${selectedSale.products?.name}
Quantity: ${selectedSale.quantity}
Unit Price: ₹${selectedSale.unit_price.toFixed(2)}
GST Amount: ₹${(selectedSale.gst_amount || 0).toFixed(2)}
Total Price: ₹${selectedSale.total_price.toFixed(2)}

CUSTOMER DETAILS
====================
Name: ${customerName}
Phone: ${customerPhone}

Thank you for your purchase!
    `.trim();
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sale-receipt-${selectedSale.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
              onClick={async () => {
                // Refresh settings when opening the dialog
                if (profile?.account_id) {
                  try {
                    const settingsRes = await supabase
                      .from('settings')
                      .select('gst_enabled, default_gst_rate')
                      .eq('account_id', profile.account_id)
                      .single();
                    
                    if (!settingsRes.error) {
                      setSettings(settingsRes.data);
                    }
                  } catch (error) {
                    console.error('Error refreshing settings:', error);
                  }
                }
              }}
            >
              <Plus className="h-5 w-5 mr-2" />
              Record Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl w-full mx-4 sm:mx-6 md:mx-8 max-h-[90vh] overflow-y-auto">
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
                      setProductPrices({});
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
                      
                      // Use custom price if set, otherwise use product's selling price
                      const unitPrice = productPrices[item.id] || product.selling_price;
                      const itemSubtotal = unitPrice * item.quantity;
                      
                      // Check if GST is enabled before calculating
                      const itemGstAmount = settings?.gst_enabled 
                        ? (itemSubtotal * settings.default_gst_rate) / 100 
                        : 0;
                        
                      const itemTotal = itemSubtotal + itemGstAmount;
                      
                      return (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <div className="flex-1">
                            <div className="font-medium text-lg">{product.name}</div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm text-muted-foreground">
                                ₹{unitPrice.toFixed(2)} × {item.quantity} = ₹{itemSubtotal.toFixed(2)}
                                {productPrices[item.id] && productPrices[item.id] !== product.selling_price && (
                                  <span className="text-blue-600 font-medium ml-2">(Adjusted)</span>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-blue-600"
                                onClick={() => {
                                  // Set the current product and price for editing
                                  setCurrentProduct(item.id);
                                  // Set the custom price to the current unit price
                                  setProductPrices(prev => ({
                                    ...prev,
                                    [item.id]: unitPrice
                                  }));
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <div className="text-right">
                              <div className="font-medium">₹{itemTotal.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">
                                {settings?.gst_enabled ? "incl. GST" : "GST disabled"}
                              </div>
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
                    <div className="space-y-2">
                      {/* Search input always visible */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          placeholder="Search products..."
                          value={productSearchTerm}
                          onChange={(e) => setProductSearchTerm(e.target.value)}
                          className="pl-10 py-2 text-sm"
                        />
                      </div>
                      
                      {/* Product selection list - always visible when searching or no product selected */}
                      {(productSearchTerm || !currentProduct) && (
                        <div className="border rounded-md bg-white max-h-40 overflow-y-auto">
                          {filteredProducts.length > 0 ? (
                            filteredProducts.map((product) => (
                              <div 
                                key={product.id}
                                className={`py-2 px-3 cursor-pointer flex justify-between items-center border-b last:border-b-0 ${
                                  currentProduct === product.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                                }`}
                                onClick={() => {
                                  setCurrentProduct(product.id);
                                  // Don't clear search term so user can see what they selected
                                }}
                              >
                                <span>{product.name}</span>
                                <span className="text-muted-foreground text-sm">Stock: {product.quantity}</span>
                              </div>
                            ))
                          ) : (
                            <div className="py-4 text-center text-muted-foreground text-sm">
                              No products found
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Show selected product when one is selected and no search is active */}
                      {currentProduct && !productSearchTerm && (
                        <div 
                          className="py-2 px-3 border rounded-md bg-white cursor-pointer flex justify-between items-center"
                          onClick={() => {
                            // Clear selection to show all products again
                            setCurrentProduct('');
                          }}
                        >
                          {(() => {
                            const selectedProduct = products.find(p => p.id === currentProduct);
                            return selectedProduct ? (
                              <>
                                <span>{selectedProduct.name}</span>
                                <span className="text-muted-foreground text-sm">Stock: {selectedProduct.quantity}</span>
                              </>
                            ) : (
                              <span>Select product</span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
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
                
                {currentProduct && (
                  <div className="space-y-2 mt-3">
                    <Label htmlFor="customPrice" className="text-sm font-medium">
                      Price (Default: ₹{products.find(p => p.id === currentProduct)?.selling_price})
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="customPrice"
                        type="number"
                        step="0.01"
                        value={productPrices[currentProduct] || products.find(p => p.id === currentProduct)?.selling_price || ''}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          setProductPrices(prev => ({
                            ...prev,
                            [currentProduct]: value
                          }));
                        }}
                        className="py-2 px-3 flex-1"
                        placeholder="Enter custom price"
                      />
                      {productPrices[currentProduct] && productPrices[currentProduct] !== products.find(p => p.id === currentProduct)?.selling_price && (
                        <span className="text-sm text-blue-600 font-medium self-center">Adjusted</span>
                      )}
                    </div>
                  </div>
                )}
                
                <Button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full bg-blue-600 hover:bg-blue-700 mt-3"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {selectedProducts.some(p => p.id === currentProduct) ? 'Update Item' : 'Add to Cart'}
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
                      <TableHead className="text-lg font-bold text-gray-700 py-4">Actions</TableHead>
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
                        <TableCell className="text-lg py-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => showSaleDetails(sale)}
                            className="text-lg py-2 px-3"
                          >
                            <Eye className="h-5 w-5" />
                          </Button>
                        </TableCell>
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

      {/* Sale Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-md w-full mx-4 sm:mx-6 md:mx-8 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Sale Details</DialogTitle>
            <DialogDescription className="text-lg">
              Detailed information about this sale
            </DialogDescription>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-gray-50 to-white border-0 shadow-md">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-xl font-bold border-b pb-2">Transaction Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Product</p>
                      <p className="font-medium">{selectedSale.products?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="font-medium">{new Date(selectedSale.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Quantity</p>
                      <p className="font-medium">{selectedSale.quantity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Unit Price</p>
                      <p className="font-medium">₹{selectedSale.unit_price.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">GST Amount</p>
                      <p className="font-medium">₹{(selectedSale.gst_amount || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Price</p>
                      <p className="font-bold text-green-600">₹{selectedSale.total_price.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-gray-50 to-white border-0 shadow-md">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-xl font-bold border-b pb-2">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{selectedSale.customer_name || "Walk-in Customer"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{selectedSale.customer_phone || "Not provided"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <Button 
                  onClick={downloadSaleDetails}
                  className="flex-1 text-lg py-3 px-6 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                >
                  Download Receipt
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="flex-1 text-lg py-3 px-6"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
