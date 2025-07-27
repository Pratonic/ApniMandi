var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  deliveries: () => deliveries,
  insertDeliverySchema: () => insertDeliverySchema,
  insertOrderItemSchema: () => insertOrderItemSchema,
  insertOrderSchema: () => insertOrderSchema,
  insertProcurementPriceSchema: () => insertProcurementPriceSchema,
  insertProductSchema: () => insertProductSchema,
  insertUserSchema: () => insertUserSchema,
  loginSchema: () => loginSchema,
  orderItems: () => orderItems,
  orderStatusEnum: () => orderStatusEnum,
  orders: () => orders,
  procurementPrices: () => procurementPrices,
  products: () => products,
  registerSchema: () => registerSchema,
  sessions: () => sessions,
  userRoleEnum: () => userRoleEnum,
  userStatusEnum: () => userStatusEnum,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var userRoleEnum = pgEnum("user_role", ["VENDOR", "PARTNER"]);
var userStatusEnum = pgEnum("user_status", ["PENDING", "APPROVED", "REJECTED"]);
var orderStatusEnum = pgEnum("order_status", ["PLACED", "PROCURING", "ON_THE_WAY", "DELIVERED"]);
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: text("sess").notNull(),
    expire: timestamp("expire").notNull()
  }
);
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  status: userStatusEnum("status").default("APPROVED"),
  stallInfo: text("stall_info"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  // kg, ltr, etc.
  image: text("image")
  // product image path
});
var orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: orderStatusEnum("status").default("PLACED"),
  total: decimal("total", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").default(sql`now()`)
});
var orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 })
});
var procurementPrices = pgTable("procurement_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date").notNull().default(sql`now()`)
});
var deliveries = pgTable("deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  partnerId: varchar("partner_id").references(() => users.id),
  deliveredAt: timestamp("delivered_at"),
  paymentReceived: decimal("payment_received", { precision: 10, scale: 2 })
});
var insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
var insertProductSchema = createInsertSchema(products).omit({ id: true });
var insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
var insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
var insertProcurementPriceSchema = createInsertSchema(procurementPrices).omit({ id: true, date: true });
var insertDeliverySchema = createInsertSchema(deliveries).omit({ id: true });
var loginSchema = createInsertSchema(users).pick({ email: true, password: true });
var registerSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(1, "Confirm password is required")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, sql as sql2 } from "drizzle-orm";
var DatabaseStorage = class {
  initialized = false;
  async initializeDefaultData() {
    if (this.initialized) return;
    try {
      const existingProducts = await db.select().from(products).limit(1);
      if (existingProducts.length > 0) {
        this.initialized = true;
        return;
      }
      const defaultProducts = [
        { name: "Onions", unit: "kg", image: "/assets/onions.jpg" },
        { name: "Potatoes", unit: "kg", image: "/assets/potatoes.jpg" },
        { name: "Cooking Oil", unit: "ltr", image: "/assets/cooking-oil.jpg" },
        { name: "Tomatoes", unit: "kg", image: "/assets/tomatoes.jpg" }
      ];
      await db.insert(products).values(defaultProducts);
      this.initialized = true;
    } catch (error) {
      console.error("Error initializing default data:", error);
    }
  }
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async updateUserStatus(id, status) {
    const [user] = await db.update(users).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, id)).returning();
    return user;
  }
  async getAllProducts() {
    await this.initializeDefaultData();
    return await db.select().from(products);
  }
  async getProduct(id) {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }
  async createOrder(insertOrder) {
    const [order] = await db.insert(orders).values(insertOrder).returning();
    return order;
  }
  async getOrder(id) {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return void 0;
    const items = await this.getOrderItems(id);
    const user = order.userId ? await this.getUser(order.userId) : void 0;
    return { ...order, items, user };
  }
  async getOrdersByUser(userId) {
    const userOrders = await db.select().from(orders).where(eq(orders.userId, userId));
    const ordersWithItems = await Promise.all(
      userOrders.map(async (order) => {
        const items = await this.getOrderItems(order.id);
        return { ...order, items };
      })
    );
    return ordersWithItems;
  }
  async getAllOrders() {
    const allOrders = await db.select().from(orders);
    const ordersWithItems = await Promise.all(
      allOrders.map(async (order) => {
        const items = await this.getOrderItems(order.id);
        const user = order.userId ? await this.getUser(order.userId) : void 0;
        return { ...order, items, user };
      })
    );
    return ordersWithItems;
  }
  async updateOrderStatus(id, status) {
    const [order] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    return order;
  }
  async createOrderItem(insertItem) {
    const [item] = await db.insert(orderItems).values(insertItem).returning();
    return item;
  }
  async getOrderItems(orderId) {
    const items = await db.select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      price: orderItems.price,
      product: products
    }).from(orderItems).innerJoin(products, eq(orderItems.productId, products.id)).where(eq(orderItems.orderId, orderId));
    return items;
  }
  async setProcurementPrice(insertPrice) {
    const [price] = await db.insert(procurementPrices).values(insertPrice).returning();
    return price;
  }
  async getLatestProcurementPrices() {
    try {
      const result = await db.select().from(procurementPrices);
      const latestPrices = /* @__PURE__ */ new Map();
      result.forEach((price) => {
        const existingPrice = latestPrices.get(price.productId);
        if (!existingPrice || price.date && existingPrice.date && new Date(price.date) > new Date(existingPrice.date)) {
          latestPrices.set(price.productId, price);
        }
      });
      return Array.from(latestPrices.values());
    } catch (error) {
      console.error("Error fetching latest procurement prices:", error);
      return [];
    }
  }
  async createDelivery(insertDelivery) {
    const [delivery] = await db.insert(deliveries).values(insertDelivery).returning();
    return delivery;
  }
  async getDelivery(orderId) {
    const [delivery] = await db.select().from(deliveries).where(eq(deliveries.orderId, orderId));
    return delivery;
  }
  async getAggregatedProcurementList() {
    try {
      const result = await db.select({
        productId: orderItems.productId,
        productName: products.name,
        quantity: orderItems.quantity,
        unit: products.unit
      }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).innerJoin(products, eq(orderItems.productId, products.id)).where(eq(orders.status, "PLACED"));
      const aggregated = /* @__PURE__ */ new Map();
      result.forEach((item) => {
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
      console.error("Error fetching aggregated procurement list:", error);
      return [];
    }
  }
  async getPartnerEarnings(partnerId) {
    try {
      const allDeliveries = await db.select().from(deliveries);
      const totalEarnings = allDeliveries.reduce((sum, delivery) => {
        const paymentAmount = delivery.paymentReceived ? parseFloat(delivery.paymentReceived.toString()) : 0;
        return sum + paymentAmount * 0.1;
      }, 0);
      return {
        totalDeliveries: allDeliveries.length,
        totalEarnings: Math.round(totalEarnings * 100) / 100
      };
    } catch (error) {
      console.error("Error fetching partner earnings:", error);
      return {
        totalDeliveries: 0,
        totalEarnings: 0
      };
    }
  }
  async getAllProductsWithPrices() {
    try {
      await this.initializeDefaultData();
      const allProducts = await db.select().from(products);
      const latestPrices = await this.getLatestProcurementPrices();
      const priceMap = new Map(latestPrices.map((p) => [p.productId, parseFloat(p.price)]));
      const currentOrderItems = await db.select({
        productId: orderItems.productId,
        quantity: orderItems.quantity
      }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(eq(orders.status, "PLACED"));
      const quantityMap = /* @__PURE__ */ new Map();
      currentOrderItems.forEach((item) => {
        const current = quantityMap.get(item.productId) || 0;
        quantityMap.set(item.productId, current + item.quantity);
      });
      return allProducts.map((product) => ({
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        currentPrice: priceMap.get(product.id),
        totalQuantityNeeded: quantityMap.get(product.id) || 0
      }));
    } catch (error) {
      console.error("Error fetching products with prices:", error);
      return [];
    }
  }
  async getAveragePriceForDay(productId, date) {
    try {
      const targetDate = date || /* @__PURE__ */ new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      const prices = await db.select().from(procurementPrices).where(sql2`${procurementPrices.productId} = ${productId} AND ${procurementPrices.date} >= ${startOfDay} AND ${procurementPrices.date} <= ${endOfDay}`);
      if (prices.length === 0) return 0;
      const totalPrice = prices.reduce((sum, price) => sum + parseFloat(price.price), 0);
      return Math.round(totalPrice / prices.length * 100) / 100;
    } catch (error) {
      console.error("Error calculating average price:", error);
      return 0;
    }
  }
  async updateOrderItemPrices(orderId) {
    try {
      const currentOrderItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const latestPrices = await this.getLatestProcurementPrices();
      const priceMap = new Map(latestPrices.map((p) => [p.productId, parseFloat(p.price)]));
      for (const item of currentOrderItems) {
        const currentPrice = priceMap.get(item.productId);
        if (currentPrice && parseFloat(item.price || "0") !== currentPrice) {
          await db.update(orderItems).set({ price: currentPrice.toString() }).where(eq(orderItems.id, item.id));
        }
      }
      const updatedItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const newTotal = updatedItems.reduce((sum, item) => {
        return sum + parseFloat(item.price || "0") * item.quantity;
      }, 40);
      await db.update(orders).set({ total: newTotal.toString() }).where(eq(orders.id, orderId));
    } catch (error) {
      console.error("Error updating order item prices:", error);
    }
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
import { z as z2 } from "zod";
import bcrypt from "bcryptjs";
var createOrderSchema = z2.object({
  items: z2.array(z2.object({
    productId: z2.string(),
    quantity: z2.number().min(1)
  }))
});
async function registerRoutes(app2) {
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const userData = registerSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = await storage.createUser({
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        role: userData.role,
        status: "APPROVED",
        stallInfo: userData.stallInfo
      });
      res.json({
        success: true,
        user: { ...user, password: void 0 },
        // Don't send password back
        token: `mock-token-${user.id}`
        // In real app, use JWT
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid request data" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      res.json({
        success: true,
        user: { ...user, password: void 0 },
        // Don't send password back
        token: `mock-token-${user.id}`
        // In real app, use JWT
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid request data" });
    }
  });
  app2.get("/api/user/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/products", async (req, res) => {
    try {
      const products2 = await storage.getAllProducts();
      res.json(products2);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/orders", async (req, res) => {
    try {
      const { items } = createOrderSchema.parse(req.body);
      const userId = req.headers["user-id"];
      if (!userId) {
        return res.status(401).json({ message: "User ID required" });
      }
      const latestPrices = await storage.getLatestProcurementPrices();
      const priceMap = new Map(latestPrices.map((p) => [p.productId, parseFloat(p.price)]));
      let total = 40;
      const order = await storage.createOrder({
        userId,
        status: "PLACED",
        total: "0"
        // Will update after items
      });
      for (const item of items) {
        const price = priceMap.get(item.productId) || 0;
        const itemTotal = price * item.quantity;
        total += itemTotal;
        await storage.createOrderItem({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: price.toString()
        });
      }
      await storage.updateOrderStatus(order.id, "PLACED");
      const finalOrder = await storage.getOrder(order.id);
      res.json(finalOrder);
    } catch (error) {
      res.status(500).json({ message: "Failed to create order" });
    }
  });
  app2.get("/api/orders/user/:userId", async (req, res) => {
    try {
      const orders2 = await storage.getOrdersByUser(req.params.userId);
      res.json(orders2);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/orders", async (req, res) => {
    try {
      const orders2 = await storage.getAllOrders();
      res.json(orders2);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      const order = await storage.updateOrderStatus(req.params.id, status);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ message: "Failed to update order status" });
    }
  });
  app2.get("/api/partner/procurement-list", async (req, res) => {
    try {
      const list = await storage.getAllProductsWithPrices();
      res.json(list);
    } catch (error) {
      console.error("Partner procurement list error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/partner/set-price", async (req, res) => {
    try {
      console.log("Price data received:", req.body);
      const { productId, price } = req.body;
      if (!productId || !price) {
        return res.status(400).json({ message: "Product ID and price are required" });
      }
      const priceData = {
        productId,
        price: parseFloat(price).toString()
      };
      const result = await storage.setProcurementPrice(priceData);
      const activeOrders = await storage.getAllOrders();
      const placedOrders = activeOrders.filter(
        (order) => order.status === "PLACED" || order.status === "PROCURING" || order.status === "ON_THE_WAY"
      );
      for (const order of placedOrders) {
        await storage.updateOrderItemPrices(order.id);
      }
      console.log(`Price updated for product ${productId}, average will be recalculated on next fetch`);
      res.json(result);
    } catch (error) {
      console.error("Price setting error:", error);
      res.status(400).json({ message: "Invalid price data" });
    }
  });
  app2.get("/api/partner/earnings", async (req, res) => {
    try {
      const partnerId = req.headers["user-id"];
      const earnings = await storage.getPartnerEarnings(partnerId);
      res.json(earnings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/partner/mark-delivered", async (req, res) => {
    try {
      console.log("Delivery data received:", req.body);
      const { orderId, paymentReceived } = req.body;
      if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
      }
      const partnerId = req.headers["user-id"];
      const deliveryData = {
        orderId,
        partnerId,
        paymentReceived: paymentReceived ? parseFloat(paymentReceived).toString() : "0",
        deliveredAt: /* @__PURE__ */ new Date()
      };
      const delivery = await storage.createDelivery(deliveryData);
      await storage.updateOrderStatus(orderId, "DELIVERED");
      res.json(delivery);
    } catch (error) {
      console.error("Delivery marking error:", error);
      res.status(400).json({ message: "Failed to mark as delivered" });
    }
  });
  app2.get("/api/procurement-prices", async (req, res) => {
    try {
      const prices = await storage.getLatestProcurementPrices();
      res.json(prices);
    } catch (error) {
      console.error("Fetch procurement prices error:", error);
      res.status(500).json({ message: "Failed to fetch procurement prices" });
    }
  });
  app2.get("/api/average-price/:productId", async (req, res) => {
    try {
      const { productId } = req.params;
      const date = req.query.date ? new Date(req.query.date) : /* @__PURE__ */ new Date();
      const averagePrice = await storage.getAveragePriceForDay(productId, date);
      res.json({ productId, averagePrice, date: date.toISOString().split("T")[0] });
    } catch (error) {
      console.error("Fetch average price error:", error);
      res.status(500).json({ message: "Failed to fetch average price" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
var index_default = app;
export {
  index_default as default
};
