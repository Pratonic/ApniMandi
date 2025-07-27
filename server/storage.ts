import { 
  type User, 
  type InsertUser,
  type Product,
  type InsertProduct,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type ProcurementPrice,
  type InsertProcurementPrice,
  type Delivery,
  type InsertDelivery,
  type OrderWithItems,
  users,
  products,
  orders,
  orderItems,
  procurementPrices,
  deliveries
} from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<User | undefined>;

  // Products
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;

  // Orders
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: string): Promise<OrderWithItems | undefined>;
  getOrdersByUser(userId: string): Promise<OrderWithItems[]>;
  getAllOrders(): Promise<OrderWithItems[]>;
  updateOrderStatus(id: string, status: 'PLACED' | 'PROCURING' | 'ON_THE_WAY' | 'DELIVERED'): Promise<Order | undefined>;

  // Order Items
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getOrderItems(orderId: string): Promise<(OrderItem & { product: Product })[]>;

  // Procurement Prices
  setProcurementPrice(price: InsertProcurementPrice): Promise<ProcurementPrice>;
  getLatestProcurementPrices(): Promise<ProcurementPrice[]>;
  getAveragePriceForDay(productId: string, date?: Date): Promise<number>;
  updateOrderItemPrices(orderId: string): Promise<void>;

  // Deliveries
  createDelivery(delivery: InsertDelivery): Promise<Delivery>;
  getDelivery(orderId: string): Promise<Delivery | undefined>;

  // Analytics
  getAggregatedProcurementList(): Promise<{ productId: string; productName: string; totalQuantity: number; unit: string }[]>;
  getAllProductsWithPrices(): Promise<{ productId: string; productName: string; unit: string; currentPrice?: number; totalQuantityNeeded?: number }[]>;
  getPartnerEarnings(partnerId?: string): Promise<{ totalDeliveries: number; totalEarnings: number }>;
}

export class DatabaseStorage implements IStorage {
  private initialized = false;

  private async initializeDefaultData() {
    if (this.initialized) return;

    try {
      // Check if products already exist
      const existingProducts = await db.select().from(products).limit(1);
      if (existingProducts.length > 0) {
        this.initialized = true;
        return;
      }

      // Default products with images
      const defaultProducts = [
        { name: "Onions", unit: "kg", image: "/assets/onions.jpg" },
        { name: "Potatoes", unit: "kg", image: "/assets/potatoes.jpg" },
        { name: "Cooking Oil", unit: "ltr", image: "/assets/cooking-oil.jpg" },
        { name: "Tomatoes", unit: "kg", image: "/assets/tomatoes.jpg" },
      ];

      await db.insert(products).values(defaultProducts);
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing default data:', error);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserStatus(id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllProducts(): Promise<Product[]> {
    await this.initializeDefaultData();
    return await db.select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db
      .insert(orders)
      .values(insertOrder)
      .returning();
    return order;
  }

  async getOrder(id: string): Promise<OrderWithItems | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const items = await this.getOrderItems(id);
    const user = order.userId ? await this.getUser(order.userId) : undefined;

    return { ...order, items, user };
  }

  async getOrdersByUser(userId: string): Promise<OrderWithItems[]> {
    const userOrders = await db.select().from(orders).where(eq(orders.userId, userId));

    const ordersWithItems = await Promise.all(
      userOrders.map(async (order: Order) => {
        const items = await this.getOrderItems(order.id);
        return { ...order, items };
      })
    );

    return ordersWithItems;
  }

  async getAllOrders(): Promise<OrderWithItems[]> {
    const allOrders = await db.select().from(orders);

    const ordersWithItems = await Promise.all(
      allOrders.map(async (order: Order) => {
        const items = await this.getOrderItems(order.id);
        const user = order.userId ? await this.getUser(order.userId) : undefined;
        return { ...order, items, user };
      })
    );

    return ordersWithItems;
  }

  async updateOrderStatus(id: string, status: 'PLACED' | 'PROCURING' | 'ON_THE_WAY' | 'DELIVERED'): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    return order;
  }

  async createOrderItem(insertItem: InsertOrderItem): Promise<OrderItem> {
    const [item] = await db
      .insert(orderItems)
      .values(insertItem)
      .returning();
    return item;
  }

  async getOrderItems(orderId: string): Promise<(OrderItem & { product: Product })[]> {
    const items = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        price: orderItems.price,
        product: products
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId));

    return items;
  }

  async setProcurementPrice(insertPrice: InsertProcurementPrice): Promise<ProcurementPrice> {
    const [price] = await db
      .insert(procurementPrices)
      .values(insertPrice)
      .returning();
    return price;
  }

  async getLatestProcurementPrices(): Promise<ProcurementPrice[]> {
    try {
      // Get all prices ordered by date descending
      const result = await db
        .select()
        .from(procurementPrices);

      // Group by product ID to get latest price for each product
      const latestPrices = new Map<string, ProcurementPrice>();
      result.forEach(price => {
        const existingPrice = latestPrices.get(price.productId);
        if (!existingPrice || (price.date && existingPrice.date && new Date(price.date) > new Date(existingPrice.date))) {
          latestPrices.set(price.productId, price);
        }
      });

      return Array.from(latestPrices.values());
    } catch (error) {
      console.error('Error fetching latest procurement prices:', error);
      return [];
    }
  }

  async createDelivery(insertDelivery: InsertDelivery): Promise<Delivery> {
    const [delivery] = await db
      .insert(deliveries)
      .values(insertDelivery)
      .returning();
    return delivery;
  }

  async getDelivery(orderId: string): Promise<Delivery | undefined> {
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderId));
    return delivery;
  }

  async getAggregatedProcurementList(): Promise<{ productId: string; productName: string; totalQuantity: number; unit: string }[]> {
    try {
      // Get all placed orders with their items and aggregate manually
      const result = await db
        .select({
          productId: orderItems.productId,
          productName: products.name,
          quantity: orderItems.quantity,
          unit: products.unit
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orders.status, 'PLACED'));

      // Aggregate quantities manually
      const aggregated = new Map<string, { productName: string; totalQuantity: number; unit: string }>();

      result.forEach(item => {
        const existing = aggregated.get(item.productId);
        if (existing) {
          existing.totalQuantity += item.quantity;
        } else {
          aggregated.set(item.productId, {
            productName: item.productName,
            totalQuantity: item.quantity,
            unit: item.unit
          });
        }
      });

      return Array.from(aggregated.entries()).map(([productId, data]) => ({
        productId,
        ...data
      }));
    } catch (error) {
      console.error('Error fetching aggregated procurement list:', error);
      return [];
    }
  }

  async getPartnerEarnings(partnerId?: string): Promise<{ totalDeliveries: number; totalEarnings: number }> {
    try {
      const allDeliveries = await db.select().from(deliveries);

      const totalEarnings = allDeliveries.reduce((sum, delivery) => {
        const paymentAmount = delivery.paymentReceived ? parseFloat(delivery.paymentReceived.toString()) : 0;
        return sum + (paymentAmount * 0.1);
      }, 0);

      return {
        totalDeliveries: allDeliveries.length,
        totalEarnings: Math.round(totalEarnings * 100) / 100
      };
    } catch (error) {
      console.error('Error fetching partner earnings:', error);
      return {
        totalDeliveries: 0,
        totalEarnings: 0
      };
    }
  }

  async getAllProductsWithPrices(): Promise<{ productId: string; productName: string; unit: string; currentPrice?: number; totalQuantityNeeded?: number }[]> {
    try {
      await this.initializeDefaultData();
      
      // Get all products
      const allProducts = await db.select().from(products);
      
      // Get latest prices
      const latestPrices = await this.getLatestProcurementPrices();
      const priceMap = new Map(latestPrices.map(p => [p.productId, parseFloat(p.price)]));
      
      // Get current order quantities
      const currentOrderItems = await db
        .select({
          productId: orderItems.productId,
          quantity: orderItems.quantity
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(eq(orders.status, 'PLACED'));
      
      // Aggregate quantities by product
      const quantityMap = new Map<string, number>();
      currentOrderItems.forEach(item => {
        const current = quantityMap.get(item.productId) || 0;
        quantityMap.set(item.productId, current + item.quantity);
      });
      
      return allProducts.map(product => ({
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        currentPrice: priceMap.get(product.id),
        totalQuantityNeeded: quantityMap.get(product.id) || 0
      }));
    } catch (error) {
      console.error('Error fetching products with prices:', error);
      return [];
    }
  }

  async getAveragePriceForDay(productId: string, date?: Date): Promise<number> {
    try {
      const targetDate = date || new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const prices = await db
        .select()
        .from(procurementPrices)
        .where(sql`${procurementPrices.productId} = ${productId} AND ${procurementPrices.date} >= ${startOfDay} AND ${procurementPrices.date} <= ${endOfDay}`);

      if (prices.length === 0) return 0;

      const totalPrice = prices.reduce((sum, price) => sum + parseFloat(price.price), 0);
      return Math.round((totalPrice / prices.length) * 100) / 100;
    } catch (error) {
      console.error('Error calculating average price:', error);
      return 0;
    }
  }

  async updateOrderItemPrices(orderId: string): Promise<void> {
    try {
      const currentOrderItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const latestPrices = await this.getLatestProcurementPrices();
      const priceMap = new Map(latestPrices.map(p => [p.productId, parseFloat(p.price)]));

      for (const item of currentOrderItems) {
        const currentPrice = priceMap.get(item.productId);
        if (currentPrice && parseFloat(item.price || '0') !== currentPrice) {
          await db
            .update(orderItems)
            .set({ price: currentPrice.toString() })
            .where(eq(orderItems.id, item.id));
        }
      }

      // Recalculate order total
      const updatedItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const newTotal = updatedItems.reduce((sum, item) => {
        return sum + (parseFloat(item.price || '0') * item.quantity);
      }, 40); // Add convenience fee

      await db
        .update(orders)
        .set({ total: newTotal.toString() })
        .where(eq(orders.id, orderId));
    } catch (error) {
      console.error('Error updating order item prices:', error);
    }
  }
}

export const storage = new DatabaseStorage();