# Apna Mandi - Street Food Vendor Marketplace

## Overview

Apna Mandi is a role-based web application designed for the street food vendor marketplace. It connects food vendors with procurement partners to streamline ingredient ordering and delivery. The application features two distinct user roles: vendors who place orders for ingredients, and partners who procure and deliver those ingredients.

**Latest Updates (July 2025):**
- Successfully migrated from Replit Agent to Replit environment
- Fixed JSX syntax errors in partner login page
- Set up PostgreSQL database with schema properly pushed
- Migrated from phone/OTP to email/password authentication system
- Removed partner approval workflow - all users are approved immediately
- Created separate partner login portal at `/partner-login`
- Fixed vendor order history to display all orders (not just delivered)
- **CRITICAL FIX**: Completely rebuilt partner registration form with simple HTML inputs
- Fixed partner registration form input issues that prevented typing
- **FIXED**: Partner price setting functionality now working correctly
- **FIXED**: Partner delivery management system now functional
- **FIXED**: Partner earnings summary now updates in real-time with accurate calculations
- Enhanced earnings calculation to use 10% commission from actual payment amounts
- Implemented automatic cache invalidation for real-time earnings updates
- **FIXED**: Added beautiful product images to marketplace with database schema updates
- **FIXED**: Procurement list and price display issues resolved
- **FIXED**: Vendor interface now shows current market prices
- Enhanced API error handling with detailed logging
- Confirmed local PostgreSQL database storage with Vercel compatibility
- **MIGRATION COMPLETE**: Successfully migrated from Replit Agent to full Replit environment
- **FIXED**: Partner procurement list now shows ALL products with current prices for anytime price setting
- **FIXED**: Database schema updated with proper partner tracking in deliveries table
- **FIXED**: Partner earnings API now working correctly with error handling
- **NEW FEATURE**: Real-time billing updates - when partners change prices, all active orders update automatically
- **NEW FEATURE**: Average price tracking for vendors - displays today's average price for each product
- **ENHANCED**: Delivery management shows updated billing amounts based on current market prices
- **VERIFIED**: Complete Vercel deployment compatibility with production build tested
- **READY**: All features verified for production deployment with Neon PostgreSQL

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a modern full-stack architecture with clear separation between client and server components:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **Session Management**: Express sessions with PostgreSQL storage

## Key Components

### Authentication System
- OTP-based authentication using phone numbers
- Role-based access control (VENDOR/PARTNER)
- Partner approval workflow with status management
- Session-based authentication with localStorage persistence

### Database Schema
- **Users**: Phone-based authentication with role and status fields
- **Products**: Static catalog of ingredients (onions, potatoes, oil, etc.)
- **Orders**: Order management with status tracking
- **Order Items**: Individual items within orders
- **Procurement Prices**: Market price tracking by partners
- **Deliveries**: Delivery tracking and payment records

### Role-Based Dashboards

#### Vendor Dashboard
- Order placement with quantity selection
- Order status tracking (Placed → Procuring → On The Way → Delivered)
- Order history with reorder functionality

#### Partner Dashboard
- Aggregated procurement list across all vendors
- Market price input and management
- Delivery management and payment tracking
- Earnings summary and analytics

## Data Flow

1. **Authentication Flow**: Users authenticate via phone OTP, select role, and receive appropriate dashboard access
2. **Order Flow**: Vendors place orders → Partners see aggregated procurement needs → Partners set market prices → Orders are fulfilled and delivered
3. **Payment Flow**: Partners input actual costs → System calculates vendor bills → Payment tracking upon delivery

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL database connection
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight React router

### UI Dependencies
- **@radix-ui/***: Comprehensive component primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### Development Dependencies
- **vite**: Build tool and dev server
- **typescript**: Type safety
- **esbuild**: Fast JavaScript bundler for server builds

## Deployment Strategy

### Build Process
- Client built with Vite to `dist/public`
- Server bundled with esbuild to `dist/index.js`
- Shared schema and types used across both client and server

### Environment Configuration
- Development: Vite dev server with Express API proxy
- Production: Standalone Node.js server serving static files and API
- Database: Neon serverless PostgreSQL with environment-based connection

### Key Configuration Files
- **drizzle.config.ts**: Database migration configuration
- **vite.config.ts**: Client build and development configuration
- **tsconfig.json**: TypeScript configuration with path mapping
- **tailwind.config.ts**: Styling configuration with custom color schemes

The application is designed for deployment on platforms like Vercel, Railway, or similar Node.js hosting services, with automatic database migrations and environment-based configuration.