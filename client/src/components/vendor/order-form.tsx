import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Product } from "@shared/schema";

export default function OrderForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const { data: prices = [] } = useQuery<any[]>({
    queryKey: ['/api/procurement-prices'],
  });

  // Query for average prices for each product - refetch when procurement prices change
  const { data: averagePrices = {} } = useQuery({
    queryKey: ['/api/average-prices', prices.length], // Include prices.length to trigger refetch
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const averagePricesData: Record<string, number> = {};
      
      for (const product of products) {
        try {
          const response = await fetch(`/api/average-price/${product.id}?date=${today}`);
          if (response.ok) {
            const data = await response.json();
            averagePricesData[product.id] = data.averagePrice;
          }
        } catch (error) {
          console.error(`Error fetching average price for ${product.name}:`, error);
        }
      }
      
      return averagePricesData;
    },
    enabled: products.length > 0,
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });

  const createOrderMutation = useMutation({
    mutationFn: async (items: { productId: string; quantity: number }[]) => {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'user-id': user?.id || ''
        },
        body: JSON.stringify({ items }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text()}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Order Placed!",
        description: "Your order has been successfully placed.",
      });
      setQuantities({});
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/user', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/procurement-prices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/average-prices'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to place order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateQuantity = (productId: string, change: number) => {
    setQuantities(prev => {
      const current = prev[productId] || 0;
      const newQuantity = Math.max(0, current + change);
      return { ...prev, [productId]: newQuantity };
    });
  };

  const handlePlaceOrder = () => {
    const items = Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    if (items.length === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select at least one item to place an order.",
        variant: "destructive",
      });
      return;
    }

    createOrderMutation.mutate(items);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="vendor-gradient text-white">
        <CardTitle className="flex items-center">
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M7.5 12.5a5 5 0 110-10 5 5 0 010 10zm3.707-5.293a1 1 0 00-1.414-1.414L7 8.586 5.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Place New Order
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {products.map((product) => (
            <div key={product.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
              <div className="w-full h-32 bg-gray-100 rounded-lg mb-3 overflow-hidden">
                <img 
                  src={product.image || '/assets/placeholder.jpg'} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDIwMCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTI4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNzBIMTAwVjcwSDEwMFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2ZyBjbGFzcz0idy0xMiBoLTEyIHRleHQtZ3JheS00MDAiIGZpbGw9ImN1cnJlbnRDb2xvciIgdmlld0JveD0iMCAwIDIwIDIwIj4KICA8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00IDNhMiAyIDAgMDAtMiAydjEwYTIgMiAwIDAwMiAyaDEyYTIgMiAwIDAwMi0yVjVhMiAyIDAgMDAtMi0ySDR6bTEyIDEySDRsNC04IDMgNiAyLTQgMyA2eiIgY2xpcC1ydWxlPSJldmVub2RkIiAvPgo8L3N2Zz4KPC9zdmc+';
                  }}
                />
              </div>
              <h3 className="font-semibold text-gray-800">{product.name}</h3>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-600">Per {product.unit}</p>
                <p className="text-lg font-bold text-orange-600">
                  ₹{(prices as any[]).find((p: any) => p.productId === product.id)?.price || '--'}
                </p>
              </div>
              {averagePrices[product.id] > 0 && (
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs text-gray-500">Today's avg price</p>
                  <p className="text-sm text-blue-600 font-medium">
                    ₹{averagePrices[product.id].toFixed(2)}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 h-8 rounded-full p-0"
                    onClick={() => updateQuantity(product.id, -1)}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </Button>
                  <span className="w-8 text-center font-medium">
                    {quantities[product.id] || 0}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-8 h-8 rounded-full p-0"
                    onClick={() => updateQuantity(product.id, 1)}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                  </Button>
                </div>
                <span className="text-xs text-gray-500">{product.unit}</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="pt-6 border-t border-gray-200">
          <Button
            onClick={handlePlaceOrder}
            disabled={createOrderMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {createOrderMutation.isPending ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6z"></path>
                </svg>
                Placing Order...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
                Place Order
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
