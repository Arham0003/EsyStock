import { useState, useEffect, useMemo } from 'react';
import CSVUpload from '@/components/CSVUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  gst: number;
  supplier: string;
  low_stock_threshold: number;
  created_at: string;
}

// Preset product categories
const PRESET_CATEGORIES = [
  "Electronics",
  "Clothing",
  "Home & Kitchen",
  "Books",
  "Beauty & Personal Care",
  "Toys & Games",
  "Sports & Outdoors",
  "Automotive",
  "Health & Wellness",
  "Food & Grocery",
  "Office Supplies",
  "Jewelry",
  "Furniture",
  "Pet Supplies",
  "Garden & Outdoor",
  "Baby Products",
  "Tools & Hardware",
  "Music & Movies",
  "Other"
];

export default function Products() {
  const { isOwner, profile } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [uploadedData, setUploadedData] = useState<string[][]>([]);
  const [parsedProducts, setParsedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching products",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const productData = {
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      category: formData.get('category') as string,
      quantity: parseInt(formData.get('quantity') as string),
      purchase_price: parseFloat(formData.get('purchase_price') as string),
      selling_price: parseFloat(formData.get('selling_price') as string),
      gst: parseFloat(formData.get('gst') as string),
      supplier: formData.get('supplier') as string,
      low_stock_threshold: parseInt(formData.get('low_stock_threshold') as string),
      account_id: profile?.account_id,
    };

    try {
      let error;
      
      if (editingProduct) {
        ({ error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id));
      } else {
        ({ error } = await supabase
          .from('products')
          .insert([productData]));
      }

      if (error) throw error;

      toast({
        title: editingProduct ? "Product updated" : "Product added",
        description: editingProduct ? "Product has been updated successfully." : "Product has been added successfully.",
      });

      setIsDialogOpen(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error saving product",
        description: error.message,
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Product deleted",
        description: "Product has been deleted successfully.",
      });

      fetchProducts();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting product",
        description: error.message,
      });
    } finally {
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const confirmDelete = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  // Memoize filtered products to prevent unnecessary recalculations
  const filteredProducts = useMemo(() => 
    products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [products, searchTerm]);

  if (!isOwner) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
        <p className="text-muted-foreground text-lg">You don't have permission to access this page.</p>
      </div>
    );
  }

  // Parse CSV data when uploaded
  useEffect(() => {
    if (uploadedData.length > 0) {
      const headers = uploadedData[0];
      const body = uploadedData.slice(1);
      
      const products: Product[] = body.map(row => ({
        id: crypto.randomUUID(),
        name: row[headers.indexOf('name')] || '',
        sku: row[headers.indexOf('sku')] || '',
        category: row[headers.indexOf('category')] || '',
        quantity: parseInt(row[headers.indexOf('quantity')]) || 0,
        purchase_price: parseFloat(row[headers.indexOf('purchase_price')]) || 0,
        selling_price: parseFloat(row[headers.indexOf('selling_price')]) || 0,
        gst: parseFloat(row[headers.indexOf('gst')]) || 0,
        supplier: row[headers.indexOf('supplier')] || '',
        low_stock_threshold: parseInt(row[headers.indexOf('low_stock_threshold')]) || 10,
        created_at: new Date().toISOString()
      })).filter(product => product.name);
      
      setParsedProducts(products);
      
      if (products.length > 0) {
        toast({
          title: `Successfully parsed ${products.length} products`,
          description: "Click 'Save All Products' to add them to your inventory",
        });
      }
    }
  }, [uploadedData]);

  const saveAllProducts = async () => {
    if (parsedProducts.length === 0) return;
    
    try {
      const productsToInsert = parsedProducts.map(product => ({
        ...product,
        account_id: profile?.account_id
      }));
      
      const { error } = await supabase
        .from('products')
        .insert(productsToInsert);
      
      if (error) throw error;
      
      toast({
        title: `Successfully added ${parsedProducts.length} products`,
        description: "All products have been added to your inventory",
      });
      
      setUploadedData([]);
      setParsedProducts([]);
      fetchProducts();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error adding products",
        description: error.message,
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Product Management
              </h1>
              <a href="/sample-products.csv" download className="text-sm text-blue-600 hover:text-blue-800 underline">
                Download Sample CSV
              </a>
            </div>
            <p className="text-muted-foreground text-lg mt-2">
              Manage your inventory products and stock levels
            </p>
          </div>
        </div>
        <CSVUpload onFileUpload={setUploadedData} />
        
        {parsedProducts.length > 0 && (
          <Card className="shadow-lg border-0 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardHeader>
              <CardTitle className="text-xl font-bold">Parsed Products</CardTitle>
              <CardDescription>Found {parsedProducts.length} products in your CSV file</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button 
                  onClick={saveAllProducts}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  Save All Products
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setUploadedData([]);
                    setParsedProducts([]);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => setEditingProduct(null)} 
              className="text-lg py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto w-[95vw]">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </DialogTitle>
              <DialogDescription className="text-lg">
                {editingProduct ? 'Update product information' : 'Enter product details to add to your inventory'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-lg font-medium">Product Name</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    required 
                    defaultValue={editingProduct?.name} 
                    className="text-lg py-3 px-4" 
                    placeholder="Enter product name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sku" className="text-lg font-medium">SKU</Label>
                  <Input 
                    id="sku" 
                    name="sku" 
                    defaultValue={editingProduct?.sku} 
                    className="text-lg py-3 px-4" 
                    placeholder="Enter SKU"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-lg font-medium">Category</Label>
                  <Select name="category" value={editingProduct?.category || ""} onValueChange={(value) => {
                    const categoryInput = document.querySelector('input[name="category"]') as HTMLInputElement;
                    if (categoryInput) {
                      categoryInput.value = value;
                    }
                  }}>
                    <SelectTrigger className="text-lg py-3 px-4">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRESET_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Hidden input to capture the selected value for form submission */}
                  <input 
                    type="hidden" 
                    name="category" 
                    value={editingProduct?.category || ""} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier" className="text-lg font-medium">Supplier</Label>
                  <Input 
                    id="supplier" 
                    name="supplier" 
                    defaultValue={editingProduct?.supplier} 
                    className="text-lg py-3 px-4" 
                    placeholder="Enter supplier"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-lg font-medium">Quantity</Label>
                  <Input 
                    id="quantity" 
                    name="quantity" 
                    type="number" 
                    required 
                    defaultValue={editingProduct?.quantity} 
                    className="text-lg py-3 px-4" 
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="low_stock_threshold" className="text-lg font-medium">Low Stock Alert</Label>
                  <Input 
                    id="low_stock_threshold" 
                    name="low_stock_threshold" 
                    type="number" 
                    defaultValue={editingProduct?.low_stock_threshold || 10} 
                    className="text-lg py-3 px-4" 
                    placeholder="10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gst" className="text-lg font-medium">GST %</Label>
                  <Input 
                    id="gst" 
                    name="gst" 
                    type="number" 
                    step="0.01" 
                    defaultValue={editingProduct?.gst || 18} 
                    className="text-lg py-3 px-4" 
                    placeholder="18"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="purchase_price" className="text-lg font-medium">Purchase Price (₹)</Label>
                  <Input 
                    id="purchase_price" 
                    name="purchase_price" 
                    type="number" 
                    step="0.01" 
                    defaultValue={editingProduct?.purchase_price} 
                    className="text-lg py-3 px-4" 
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="selling_price" className="text-lg font-medium">Selling Price (₹)</Label>
                  <Input 
                    id="selling_price" 
                    name="selling_price" 
                    type="number" 
                    step="0.01" 
                    required 
                    defaultValue={editingProduct?.selling_price} 
                    className="text-lg py-3 px-4" 
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <Button 
                  type="submit" 
                  className="flex-1 text-lg py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {editingProduct ? 'Update Product' : 'Add Product'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)} 
                  className="flex-1 text-lg py-3 px-6"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl">Confirm Product Deletion</DialogTitle>
              <DialogDescription className="text-lg">
                Are you sure you want to delete this product? This action cannot be undone and the item will be permanently removed from your inventory.
              </DialogDescription>
            </DialogHeader>
            {productToDelete && (
              <div className="py-4">
                <div className="flex items-center gap-4 p-4 bg-red-50 rounded-lg">
                  <div className="bg-red-100 p-3 rounded-full">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{productToDelete.name}</h3>
                    <p className="text-muted-foreground">SKU: {productToDelete.sku || 'N/A'}</p>
                  </div>
                </div>
                <p className="mt-4 text-red-600 font-medium">
                  Warning: This action is irreversible. Once deleted, the product cannot be recovered.
                </p>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setProductToDelete(null);
                }}
                className="text-lg py-3 px-6"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => productToDelete && handleDelete(productToDelete.id)}
                className="text-lg py-3 px-6"
              >
                <Trash2 className="h-5 w-5 mr-2" />
                Delete Permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>

      <Card className="shadow-xl border-0 bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-2xl font-bold">Product Inventory</CardTitle>
              <CardDescription className="text-lg mt-1">
                Total: {products.length} products
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-lg py-3 px-4 w-full"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-muted-foreground text-lg">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gray-100 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                <Package className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold mb-2">No Products Found</h3>
              <p className="text-muted-foreground text-lg mb-6">
                {searchTerm ? 'No products match your search.' : 'Your inventory is empty.'}
              </p>
              <Button 
                onClick={() => {
                  setSearchTerm('');
                  setIsDialogOpen(true);
                  setEditingProduct(null);
                }} 
                className="text-lg py-3 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Your First Product
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border-0 bg-white shadow-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <TableRow>
                    <TableHead className="text-lg font-bold text-gray-700 py-4">Name</TableHead>
                    <TableHead className="text-lg font-bold text-gray-700 py-4">SKU</TableHead>
                    <TableHead className="text-lg font-bold text-gray-700 py-4">Category</TableHead>
                    <TableHead className="text-lg font-bold text-gray-700 py-4">Quantity</TableHead>
                    <TableHead className="text-lg font-bold text-gray-700 py-4">Price</TableHead>
                    <TableHead className="text-lg font-bold text-gray-700 py-4">Status</TableHead>
                    <TableHead className="text-lg font-bold text-gray-700 py-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow 
                      key={product.id} 
                      className="hover:bg-blue-50 transition-colors"
                    >
                      <TableCell className="font-medium text-lg py-4">{product.name}</TableCell>
                      <TableCell className="text-lg py-4">{product.sku}</TableCell>
                      <TableCell className="text-lg py-4">{product.category}</TableCell>
                      <TableCell className="text-lg py-4">
                        <Badge 
                          variant={product.quantity <= product.low_stock_threshold ? "destructive" : "default"}
                          className="text-lg py-2 px-3"
                        >
                          {product.quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-lg py-4">₹{product.selling_price}</TableCell>
                      <TableCell className="py-4">
                        <Badge 
                          variant={product.quantity <= product.low_stock_threshold ? "destructive" : "default"}
                          className="text-lg py-2 px-3"
                        >
                          {product.quantity <= product.low_stock_threshold ? "Low Stock" : "In Stock"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingProduct(product);
                              setIsDialogOpen(true);
                            }}
                            className="text-lg py-2 px-4"
                          >
                            <Edit className="h-5 w-5 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => confirmDelete(product)}
                            className="text-lg py-2 px-4 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          >
                            <Trash2 className="h-5 w-5 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}