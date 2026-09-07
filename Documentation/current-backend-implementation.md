# Current Backend Implementation — Campus Cafeteria

> **Purpose:** Technical reference document describing the existing Node.js backend architecture and Razorpay payment implementation, for use during HDFC Collect Now migration.
>
> **Generated:** 2026-09-07 | **Status:** Analysis of current codebase (no modifications made)

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Application Architecture](#2-application-architecture)
3. [Application Entry Point](#3-application-entry-point)
4. [Server / Framework Configuration](#4-server--framework-configuration)
5. [API Architecture](#5-api-architecture)
6. [Authentication and Authorization](#6-authentication-and-authorization)
7. [Appwrite Integration](#7-appwrite-integration)
8. [MongoDB Integration](#8-mongodb-integration)
9. [Order Management](#9-order-management)
10. [Payment Architecture](#10-payment-architecture)
11. [Existing Razorpay Implementation](#11-existing-razorpay-implementation)
12. [Complete Payment Flow](#12-complete-payment-flow)
13. [Payment API Inventory](#13-payment-api-inventory)
14. [Kitchen & Scheduling System](#14-kitchen--scheduling-system)
15. [Notifications (FCM)](#15-notifications-fcm)
16. [Reporting System](#16-reporting-system)
17. [Socket.IO / Real-Time](#17-socketio--real-time)
18. [Security Analysis](#18-security-analysis)
19. [Environment Variables](#19-environment-variables)
20. [HDFC Migration-Relevant Inventory](#20-hdfc-migration-relevant-inventory)
21. [Summary](#21-summary)

---

## 1. Project Structure

### Dual-Source Architecture

The codebase uses **two parallel source trees**:

| Directory | Language | Description |
|---|---|---|
| `src/` | JavaScript (ES Modules) | Controllers, routes, services, models, config for Razorpay, data, notifications, reports |
| `src-ts/` | TypeScript | Compiled to `dist/` — account management, password reset, kitchen services, socket, allocation engine, types |
| `dist/` | Compiled JS (from `src-ts`) | Runtime code for TypeScript modules, referenced directly by `server.js` and `src/` files |

> **Important:** `server.js` (root) is the entry point. It imports from both `src/` and `dist/` directly. The TypeScript compilation target is `dist/` with `rootDir: src-ts`.

### Root-Level Files

| File | Purpose |
|---|---|
| `server.js` | Application entry point. Sets up Express, Socket.io, MongoDB, mounts all routes. |
| `package.json` | Dependencies and scripts. `"type": "module"` (ESM). |
| `tsconfig.json` | TypeScript config: target ES2020, module NodeNext, outDir `dist`, rootDir `src-ts`. |
| `js-modules.d.ts` | TypeScript ambient declaration: `declare module "*.js"` for allowing JS imports. |
| `.env` | Environment variables (gitignored). |
| `.gitignore` | Ignores `node_modules/` and `.env`. |

### Directory Tree

```
canteen_backend/
├── server.js                          # Entry point
├── package.json
├── tsconfig.json
├── js-modules.d.ts
├── .env
├── .gitignore
│
├── src/                               # JavaScript source
│   ├── config/
│   │   ├── razorpay.js                # Razorpay SDK client initialization
│   │   └── firebase.js                # Firebase Admin SDK initialization
│   ├── controllers/
│   │   ├── razorpay.controller.js     # Payment endpoints (create order, verify, fail, cancel)
│   │   ├── data.controller.js         # Generic MongoDB CRUD endpoints
│   │   ├── notification.controller.js # FCM notification endpoints
│   │   └── report.controller.js       # Report generation endpoint
│   ├── models/
│   │   ├── OrderModel.js              # Order data class (constructor from raw doc)
│   │   └── OrderItem.js               # OrderItem data class
│   ├── routes/
│   │   ├── razorpay.routes.js         # /api/razorpay/* routes
│   │   ├── data.routes.js             # /api/query, /api/doc/* routes
│   │   ├── kitchen.routes.js          # /api/kitchen/* routes
│   │   ├── notification.routes.js     # /api/notify/* routes
│   │   └── report.routes.js           # /reports/* routes
│   └── services/
│       ├── razorpay.service.js        # Razorpay business logic (create, verify, refund)
│       ├── fcm.service.js             # Firebase Cloud Messaging service
│       ├── firestore.service.js       # Firestore datasource (legacy/unused for main flow)
│       ├── datasource/
│       │   ├── BackendDatasource.js   # Abstract base class
│       │   ├── MongoDatasource.js     # MongoDB implementation (active)
│       │   └── FirebaseDatasource.js  # Firestore implementation (legacy)
│       └── reports/
│           ├── index.js               # Report registry
│           ├── totalSales.report.js
│           ├── transactionHistory.report.js
│           ├── studentTransactionRecord.report.js
│           └── stockSold.report.js
│
├── src-ts/                            # TypeScript source
│   ├── config/
│   │   └── mongodb.ts                 # MongoDB connection (connectMongo, getDb)
│   ├── controller/
│   │   ├── account.controller.ts      # Account deletion (Appwrite + Mongo)
│   │   └── password.controller.ts     # Password reset (Appwrite + email)
│   ├── models/
│   │   ├── KitchenItem.ts             # KitchenItem interface
│   │   └── passwordResetModel.ts      # Password reset token model (Mongo)
│   ├── routes/
│   │   ├── accounts.routes.ts         # DELETE /api/account/delete
│   │   └── password.routes.ts         # Commented out — not active
│   ├── services/
│   │   ├── AllocationEngine.ts        # Order fulfillment allocation logic
│   │   ├── KitchenScheduler.ts        # Scheduled status promotion (status 1→2)
│   │   └── KitchenService.ts          # Kitchen item CRUD
│   ├── socket/
│   │   └── SocketGateway.ts           # Socket.io setup + kitchen room emit
│   └── types/
│       └── Order.ts                   # TypeScript interfaces for Order, OrderItem
│
├── dist/                              # Compiled output from src-ts (referenced by server.js)
│   ├── config/
│   │   └── mongodb.js
│   ├── controller/
│   │   ├── account.controller.js
│   │   └── password.controller.js
│   ├── models/
│   │   ├── KitchenItem.js
│   │   └── passwordResetModel.js
│   ├── routes/
│   │   ├── accounts.routes.js
│   │   └── password.routes.js         # Commented out
│   ├── services/
│   │   ├── AllocationEngine.js
│   │   ├── KitchenScheduler.js
│   │   └── KitchenService.js
│   ├── socket/
│   │   └── SocketGateway.js
│   └── types/
│       └── Order.js
│
└── Documentation/
    └── current-backend-implementation.md  # This file
```

---

## 2. Application Architecture

### High-Level Request Flow

```
Client (Flutter App)
    │
    │  HTTP / WebSocket
    ▼
Express Server (server.js)
    │
    ├─ app.use(cors())          ← CORS (wide open: origin: "*")
    ├─ app.use(express.json())  ← Body parser
    │
    ├─ Route: /api/razorpay/*   → razorpay.controller.js → razorpay.service.js → Razorpay API + MongoDB
    ├─ Route: /api/* (data)     → data.controller.js → MongoDatasource → MongoDB
    ├─ Route: /api/kitchen/*    → kitchen.routes.js → KitchenService + AllocationEngine → MongoDB
    ├─ Route: /api/notify/*     → notification.controller.js → FCMService → Firebase Admin
    ├─ Route: /reports/*        → report.controller.js → reports/* → MongoDatasource → MongoDB
    ├─ Route: /api/account/*    → account.controller.js → Appwrite Admin SDK + MongoDatasource
    │
    ├─ Socket.IO               → SocketGateway → kitchen-room broadcasts
    │
    └─ KitchenScheduler        → Background interval (30s) → status promotion 1→2
```

### Key Architectural Observations

1. **No centralized router file** — routes are mounted individually in `server.js`.
2. **No authentication middleware** on API routes — the payment endpoints, data endpoints, and kitchen endpoints have **no auth guards**.
3. **Mixed JS/TS codebase** — `src/` (JS) and `src-ts/` (TS → `dist/`) coexist and cross-reference each other extensively.
4. **Datasource abstraction** exists (`BackendDatasource` → `MongoDatasource`) but the legacy `FirebaseDatasource` is still in the codebase (unused in production flow).
5. **No dedicated order creation endpoint** in the backend — orders appear to be created by the Flutter client directly via generic `POST /api/doc/:collection/:docId` (setDoc), then payment is handled separately.

---

## 3. Application Entry Point

**File:** `server.js` (root)

**What it does:**

1. Imports Express, CORS, dotenv, http, Socket.IO
2. Calls `dotenv.config()` to load `.env`
3. Imports and calls `connectMongo()` from `dist/config/mongodb.js`
4. Creates HTTP server and attaches Socket.IO (CORS: `origin: "*"`)
5. Initializes Socket.IO gateway via `initSocket(io)`
6. Starts `KitchenScheduler` background job
7. Mounts all route modules
8. Listens on `process.env.PORT || 8080`

**Route Mounting:**

| Mount Path | Router | Source |
|---|---|---|
| `/api/razorpay` | `razorpayRoutes` | `src/routes/razorpay.routes.js` |
| `/api` | `dataRoutes` | `src/routes/data.routes.js` |
| `/api/kitchen` | `kitchenRoutes` | `src/routes/kitchen.routes.js` |
| `/api/notify` | `notificationRoutes` | `src/routes/notification.routes.js` |
| `/reports` | `reportRoutes` | `src/routes/report.routes.js` |
| `/api` | `accountRoutes` | `dist/routes/accounts.routes.js` |
| `/` (GET) | Health check | Inline — returns "Canteen Backend Running" |

**Note:** Password routes (`password.routes.ts`) are **commented out** in both `server.js` and the route file — not active.

---

## 4. Server / Framework Configuration

| Aspect | Value |
|---|---|
| Framework | Express 4.18.2 |
| Module System | ES Modules (`"type": "module"`) |
| Body Parser | `express.json()` (built-in) |
| CORS | `cors()` with no configuration — allows all origins |
| HTTP Server | Node.js `http.createServer(app)` |
| WebSocket | Socket.IO 4.8.3 |
| Port | `process.env.PORT` or `8080` |

**No middleware stack beyond CORS and JSON parsing.** There is:
- No rate limiting
- No helmet/security headers
- No request logging (morgan, etc.)
- No authentication middleware
- No input validation library (joi, zod, etc.)
- No error-handling middleware (errors caught per-route in try/catch)

---

## 5. API Architecture

### All Active Endpoints

| Method | Endpoint | Purpose | Auth Required | Source File |
|---|---|---|---|---|
| GET | `/` | Health check | No | `server.js` |
| POST | `/api/razorpay/create-order` | Create Razorpay order | No | `razorpay.routes.js` |
| POST | `/api/razorpay/verify-payment` | Verify Razorpay payment signature | No | `razorpay.routes.js` |
| POST | `/api/razorpay/payment-failed` | Mark payment as failed | No | `razorpay.routes.js` |
| POST | `/api/razorpay/cancel-order` | Cancel order + process refund | No | `razorpay.routes.js` |
| POST | `/api/query` | Generic MongoDB query | No | `data.routes.js` |
| POST | `/api/query/paginated` | Generic paginated query | No | `data.routes.js` |
| GET | `/api/doc/:collection/:docId` | Get document by ID | No | `data.routes.js` |
| PUT | `/api/doc/:collection/:docId` | Set/upsert document | No | `data.routes.js` |
| PATCH | `/api/doc/:collection/:docId` | Update document fields | No | `data.routes.js` |
| DELETE | `/api/doc/:collection/:docId` | Delete document | No | `data.routes.js` |
| GET | `/api/doc/:collection/:docId/exists` | Check document exists | No | `data.routes.js` |
| GET | `/api/kitchen/snapshot` | Get kitchen items snapshot | No | `kitchen.routes.js` |
| POST | `/api/kitchen/decrement` | Decrement kitchen item quantity | No | `kitchen.routes.js` |
| POST | `/api/kitchen/clear` | Clear kitchen item + cancel associated orders | No | `kitchen.routes.js` |
| POST | `/api/notify/new-order` | Send new-order notification to admins | No | `notification.routes.js` |
| POST | `/api/notify/order-status` | Send status-update notification to customer | No | `notification.routes.js` |
| POST | `/reports/generate` | Generate reports (sales, transactions, etc.) | No | `report.routes.js` |
| DELETE | `/api/account/delete` | Delete user account (Appwrite + Mongo) | `x-internal-secret` header | `accounts.routes.js` |

> **Critical Observation:** Almost all endpoints are unauthenticated. The only endpoint with any access control is `DELETE /api/account/delete`, which checks `x-internal-secret` header against `INTERNAL_DELETE_SECRET` env var.

---

## 6. Authentication and Authorization

### Current State

**There is NO backend authentication/authorization middleware.** The backend does not:
- Verify JWT tokens
- Validate Appwrite sessions
- Check cookies
- Use any auth middleware on routes

### Account Deletion (the one exception)

`DELETE /api/account/delete` (`src-ts/controller/account.controller.ts:13-64`):
- Checks `req.headers["x-internal-secret"]` against `process.env.INTERNAL_DELETE_SECRET`
- If valid, verifies the user's password by creating a temporary Appwrite session
- Deletes the user from Appwrite and MongoDB

### Implications for Payment

- Payment endpoints (`/api/razorpay/*`) are **completely unauthenticated**
- Anyone who knows the endpoints can create orders, trigger verification, and cancel orders
- The `firestoreOrderId` parameter in payment endpoints is the **sole identifier** linking a payment to an order
- **No server-side session validation** — the backend trusts the client to provide correct identifiers

---

## 7. Appwrite Integration

### Current Usage

Appwrite is used **only** for account management (not payment, not order creation):

| Feature | Implementation | File |
|---|---|---|
| User deletion | `Users.delete(userId)` via Admin SDK | `src-ts/controller/account.controller.ts:45` |
| Password verification | `Account.createEmailPasswordSession()` | `src-ts/controller/account.controller.ts:39` |
| Password update | `Users.updatePassword()` | `src-ts/controller/password.controller.ts:83` |
| Client setup | `Client` with endpoint, project, API key | `src-ts/controller/account.controller.ts:5-8` |

### Appwrite SDK Usage

```typescript
// Admin client (for server-side operations)
import { Client, Users, Account } from "node-appwrite";

const adminClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);
```

### Appwrite + MongoDB Relationship

- Appwrite user IDs are stored in MongoDB's `users` collection as `_id` (the document ID matches the Appwrite user ID)
- The `users` collection stores: `uid`, `name`, `type`, `fcmToken`, `email`
- Appwrite is **not** used for order management or payment — orders live in MongoDB's `OrderHistory` collection
- Appwrite user IDs are referenced in orders via the `userUid` field

### Appwrite NOT Used For

- Payment processing
- Order creation
- Session management for API access
- Payment webhooks

---

## 8. MongoDB Integration

### Connection

**File:** `src-ts/config/mongodb.ts` → compiled to `dist/config/mongodb.js`

```typescript
import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(process.env.MONGODB_URI as string);
  await client.connect();
  db = client.db();  // Uses default DB from connection string
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("MongoDB not initialized");
  return db;
}
```

- **Driver:** Native MongoDB driver v7.0.0 (NOT Mongoose)
- **No schema validation** — documents are schemaless
- **No model layer** — raw MongoDB operations via `collection()` calls
- **Singleton pattern** — `connectMongo()` called once at startup in `server.js`

### Collections Used

| Collection | Purpose | Key Fields |
|---|---|---|
| `OrderHistory` | All orders (current and historical) | `_id`, `status`, `items[]`, `overallTotal`, `paymentMode`, `userUid`, `createdAt`, `updatedAt`, `paymentVerified`, `paymentStatus`, `paymentDetails`, `razorpayPaymentId`, `refundStatus`, `refundId`, `refundInitiatedAt`, `refundedAt`, `refundFailure`, `paymentFailure`, `kitchenScheduledAt`, `pickupMode`, `pickupTime`, `fcm`, `notes` |
| `users` | User accounts | `_id` (matches Appwrite userId), `uid`, `name`, `email`, `type`, `fcmToken` |
| `kitchen_items` | Kitchen inventory tracking | `itemId`, `itemName`, `totalQuantity`, `allocations[]`, `lastUpdatedAt` |
| `passwordResets` | Password reset tokens | `email`, `token` (hashed), `expiresAt` |

### OrderHistory — Inferred Schema

Since there's no Mongoose schema, the following fields are inferred from code usage across `razorpay.service.js`, `notification.controller.js`, `AllocationEngine.ts`, and `KitchenScheduler.ts`:

```
OrderHistory document:
{
  _id: string                    // Firestore-style order ID (not MongoDB ObjectId)
  orderId: string                // Alternate order identifier
  docId: string                  // Document ID
  fcm: string                    // Customer's FCM token
  userUid: string                // Appwrite user UID
  overallTotal: number           // Order total in INR (rupees, not paise)
  paymentMode: string            // Payment method
  status: number                 // Order status code (-1 to 6)
  createdAt: Date | number       // Epoch milliseconds
  updatedAt: number              // Epoch milliseconds (set on updates)
  notes: string | null           // Customer notes
  isPaymentStatus: boolean       // (Legacy?) payment status flag
  pickupMode: "now" | "later"    // Pickup timing
  pickupTime: number | null      // Epoch milliseconds for later pickup
  
  // Payment fields (set after Razorpay verification)
  paymentVerified: boolean       // Whether payment was verified
  paymentStatus: string          // "SUCCESS" | not set
  razorpayPaymentId: string      // Razorpay payment ID
  paymentDetails: {
    orderId: string              // Razorpay order ID
    paymentId: string            // Razorpay payment ID
    signature: string            // Razorpay signature
    verifiedAt: number           // Epoch ms
  }
  
  // Refund fields
  refundStatus: string           // "NONE" | "PROCESSING" | "SUCCESS" | "FAILED"
  refundId: string               // Razorpay refund ID
  refundInitiatedAt: number      // Epoch ms
  refundedAt: number             // Epoch ms
  refundFailure: {
    message: string
    failedAt: number
  }
  
  // Payment failure
  paymentFailure: {
    reason: string
    failedAt: number
  }
  
  // Kitchen scheduling
  kitchenScheduledAt: number     // Epoch ms — when to promote to "In making"
  
  // Order items
  items: [{
    prodId: string
    name: string
    image: string
    isVeg: boolean
    catId: string
    price: number                // Unit price in rupees
    status: number
    unit: string
    quantity: number
    totalPrice: number           // Computed: price * quantity
    fulfilledQty: number         // Set by AllocationEngine
  }]
}
```

### Order Status Codes

| Code | Meaning | Set Where |
|---|---|---|
| `-1` | Not paid (initial state) | Created by client |
| `0` | Paid, not accepted | Referenced but not explicitly set in backend code |
| `1` | Accepted / Scheduled for kitchen | `razorpay.service.js:159` (pickup later), `AllocationEngine.ts:81` |
| `2` | In making | `razorpay.service.js:120,178` (pickup now or within window), `KitchenScheduler.ts:40` |
| `3` | Ready to pick | `AllocationEngine.ts:81` (all items fulfilled) |
| `4` | Picked up (completed) | Referenced in report queries (`MongoDatasource.js:82`) |
| `5` | Cancelled | `razorpay.service.js:33`, `kitchen.routes.js:50` |
| `6` | Payment failed | `razorpay.service.js:212` |

### Indexes

Only one explicit index is created in code:
```typescript
// KitchenScheduler.ts:15-17
db.collection("OrderHistory").createIndex({ status: 1, kitchenScheduledAt: 1 });
```

No other indexes are defined in the codebase. Query patterns suggest the need for indexes on `_id` (default), `createdAt`, `status`, and `userUid`.

---

## 9. Order Management

### How Orders Are Created

**Orders are NOT created by the backend.** The backend has no `POST /api/orders` endpoint. Based on the data flow:

1. The **Flutter client** creates an order document by calling `PUT /api/doc/OrderHistory/:orderId` (the generic setDoc endpoint in `data.routes.js`)
2. The client then calls `POST /api/razorpay/create-order` with the order amount and the Firestore order ID
3. After Razorpay checkout completes on the client, the client calls `POST /api/razorpay/verify-payment`

This means **the client controls the initial order document** written to MongoDB. The backend does not validate order contents, amounts, or item integrity at creation time.

### Order Lifecycle (Backend-Managed Parts)

```
Client creates order (status: -1)
    │
    ├─ Client → POST /api/razorpay/create-order → Backend → Razorpay API → order_id returned
    │
    ├─ Client → Razorpay Checkout (SDK)
    │
    ├─ Payment success:
    │   └─ Client → POST /api/razorpay/verify-payment
    │       ├─ Signature verified (HMAC SHA256)
    │       ├─ Order status updated
    │       │   ├─ pickupMode="now" → status: 2 (In making)
    │       │   └─ pickupMode="later" → status: 1 (Accepted) + kitchenScheduledAt
    │       ├─ KitchenService.addOrderItems() called
    │       └─ Socket.IO kitchen_update emitted
    │
    ├─ Payment failure:
    │   └─ Client → POST /api/razorpay/payment-failed → status: 6
    │
    └─ Cancel + Refund:
        └─ Client → POST /api/razorpay/cancel-order
            ├─ status: 5 (Cancelled)
            └─ If payment was verified → Razorpay refund API called
```

### Order Cancellation

Handled by `RazorpayService.cancelAndRefund()` (`src/services/razorpay.service.js:20-90`):
1. Fetches order from MongoDB
2. Skips if already cancelled (status 5)
3. Sets status to 5
4. If payment was not verified → no refund needed
5. If refund already processed → prevents double refund
6. Marks refund as PROCESSING
7. Calls `razorpayInstance.payments.refund()`
8. Updates refund status (SUCCESS or FAILED)

---

## 10. Payment Architecture

### Overview

The payment system is **Razorpay-only**, using the Razorpay Orders API with client-side checkout. The backend:

1. Creates Razorpay orders (server-side)
2. Verifies payment signatures (server-side)
3. Marks payment failures (client-reported)
4. Processes refunds (server-side)

**There is no webhook handler.** All payment state changes are driven by the Flutter client calling backend endpoints.

### Payment-Related Files

| File | Role |
|---|---|
| `src/config/razorpay.js` | Razorpay SDK client initialization |
| `src/services/razorpay.service.js` | Core payment business logic (create, verify, refund, fail) |
| `src/controllers/razorpay.controller.js` | HTTP endpoint handlers for payment operations |
| `src/routes/razorpay.routes.js` | Route definitions |
| `src/services/datasource/MongoDatasource.js` | Order read/write operations |
| `server.js` | Mounts `/api/razorpay` routes |

---

## 11. Existing Razorpay Implementation

### Razorpay SDK

- **Package:** `razorpay` v2.9.6 (from `package.json`)
- **Import:** `import Razorpay from "razorpay"`
- **Instance:** Created as singleton in `src/config/razorpay.js`

### Razorpay Client Initialization

**File:** `src/config/razorpay.js`

```javascript
import Razorpay from "razorpay";

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

export default razorpayInstance;
```

**Environment Variables:**
- `RAZORPAY_KEY_ID` — Razorpay key ID
- `RAZORPAY_SECRET` — Razorpay key secret (also used for HMAC verification)

### 11.1 Create Order

**Endpoint:** `POST /api/razorpay/create-order`

**Controller:** `src/controllers/razorpay.controller.js:4-18`

```javascript
async createOrder(req, res) {
  const { amount, firestoreOrderId } = req.body;
  // Validates both fields present
  const order = await RazorpayService.createOrder(amount, firestoreOrderId);
  res.json({ success: true, order });
}
```

**Service:** `src/services/razorpay.service.js:12-18`

```javascript
async createOrder(amount, receiptId) {
  return razorpayInstance.orders.create({
    amount: amount * 100,      // Convert rupees to paise
    currency: "INR",
    receipt: receiptId,        // Firestore/Mongo order ID used as receipt
  });
}
```

**Key Details:**
- Amount is passed in **rupees** from the client, multiplied by 100 to convert to **paise** for Razorpay
- Currency is hardcoded to `"INR"`
- Receipt is the MongoDB `OrderHistory` document `_id` (referred to as `firestoreOrderId` in code)
- No `payment_capture` parameter specified — defaults to Razorpay's default (auto-capture)
- No `notes` or `metadata` passed to the Razorpay order
- Returns the full Razorpay order object to the client

### 11.2 Verify Payment

**Endpoint:** `POST /api/razorpay/verify-payment`

**Controller:** `src/controllers/razorpay.controller.js:21-49`

```javascript
async verifyPayment(req, res) {
  const { orderId, paymentId, signature, firestoreOrderId } = req.body;
  const result = await RazorpayService.verifyPayment({
    orderId, paymentId, signature, firestoreOrderId
  });
  if (!result.verified) {
    await RazorpayService.markPaymentFailed(firestoreOrderId, "invalid_signature");
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }
  res.json({ success: true });
}
```

**Service — Signature Verification:** `src/services/razorpay.service.js:93-104`

```javascript
async verifyPayment({ orderId, paymentId, signature, firestoreOrderId }) {
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== signature) {
    return { verified: false };
  }
  // ... continue with order update
}
```

**Key Details:**
- Signature is computed as HMAC-SHA256 of `{orderId}|{paymentId}` using `RAZORPAY_SECRET`
- This matches Razorpay's standard signature verification algorithm
- The `orderId` here is the **Razorpay order ID** (not the MongoDB document ID)
- The `firestoreOrderId` is the MongoDB document ID
- **No timing-safe comparison** — uses `!==` instead of `crypto.timingSafeEqual()`
- If signature is invalid, payment is marked as failed

### 11.3 Post-Verification Order Update

**Service:** `src/services/razorpay.service.js:106-194`

After signature verification succeeds:

1. **Double-processing guard:** Checks if `order.status !== -1` (already processed). If so, returns `{ verified: true, ignored: true }`.

2. **Case 1 — Pickup Now** (`order.pickupMode === "now"`):
   ```
   Update: status=2, paymentVerified=true, paymentStatus="SUCCESS",
           razorpayPaymentId=paymentId, refundStatus="NONE",
           paymentDetails={orderId, paymentId, signature, verifiedAt}
   ```
   Then: `KitchenService.addOrderItems(updatedOrder)` → emits kitchen update via Socket.IO

3. **Case 2 — Pickup Later** (`order.pickupMode === "later"`):
   ```
   Update: status=1, paymentVerified=true, paymentStatus="SUCCESS",
           razorpayPaymentId=paymentId, refundStatus="NONE",
           kitchenScheduledAt=pickupTimestamp - 15min,
           paymentDetails={orderId, paymentId, signature, verifiedAt}
   ```
   If `kitchenScheduledAt <= now` (already within the 15-minute window):
   - Immediately promotes to status=2
   - Adds to kitchen
   - Emits kitchen update

### 11.4 Payment Failure Handling

**Endpoint:** `POST /api/razorpay/payment-failed`

**Controller:** `src/controllers/razorpay.controller.js:52-69`

```javascript
async paymentFailed(req, res) {
  const { firestoreOrderId, reason } = req.body;
  await RazorpayService.markPaymentFailed(firestoreOrderId, reason || "payment_failed");
  res.json({ success: true });
}
```

**Service:** `src/services/razorpay.service.js:197-221`

```javascript
async markPaymentFailed(firestoreOrderId, reason) {
  const order = await ds.getOrderById(firestoreOrderId);
  if (order.status === 0) return { ignored: true };  // Paid but not accepted — don't override
  if (order.status === 6) return { ignored: true };  // Already marked failed
  await ds.updateOrderStatus(firestoreOrderId, {
    status: 6,
    paymentVerified: false,
    paymentFailure: { reason, failedAt: Date.now() },
  });
  return { success: true };
}
```

**Key Details:**
- Called by the client when Razorpay checkout reports failure
- Also called by the verify endpoint when signature is invalid
- Protects against overriding a successfully paid order (status 0)
- Prevents duplicate failure writes (status 6)

### 11.5 Refund Handling

**Endpoint:** `POST /api/razorpay/cancel-order`

**Controller:** `src/controllers/razorpay.controller.js:72-88`

```javascript
async cancelOrder(req, res) {
  const { orderId } = req.body;
  const result = await RazorpayService.cancelAndRefund(orderId);
  return res.json(result);
}
```

**Service:** `src/services/razorpay.service.js:20-91`

Refund flow:
1. Fetch order from MongoDB
2. Skip if already cancelled (status 5)
3. Set status to 5 (Cancelled)
4. If `paymentVerified` is false → no refund needed (return `NOT_REQUIRED`)
5. If refund already processed (`refundStatus !== "NONE"`) → prevent double refund
6. Mark `refundStatus: "PROCESSING"`
7. Call `razorpayInstance.payments.refund(paymentId, { amount: overallTotal * 100 })`
8. On success: `refundStatus: "SUCCESS"`, store `refundId`
9. On failure: `refundStatus: "FAILED"`, store `refundFailure` details

**Key Details:**
- Refund amount is `order.overallTotal * 100` (rupees → paise)
- Full refund only (no partial refund support)
- Refund failure is caught and stored but not re-thrown
- Refund status is tracked in MongoDB for idempotency

### 11.6 Webhook Handling

**There is NO webhook endpoint.** The backend does not receive Razorpay webhooks. All payment status updates are driven by the Flutter client calling the backend endpoints.

This is a **significant gap** — if the client fails to call `verify-payment` after a successful Razorpay payment, the order will remain in status -1 (not paid) in MongoDB even though the payment was actually captured by Razorpay.

---

## 12. Complete Payment Flow

### Happy Path — Pickup Now

```
1. Client creates order document in MongoDB via:
   PUT /api/doc/OrderHistory/:orderId
   Body: { overallTotal, items[], userUid, pickupMode: "now", ... }
   → Order stored with status: -1 (not paid)

2. Client requests Razorpay order:
   POST /api/razorpay/create-order
   Body: { amount: <rupees>, firestoreOrderId: "<orderId>" }
   → Razorpay SDK: orders.create({ amount: amount*100, currency: "INR", receipt: firestoreOrderId })
   → Returns: { id: "order_xxx", ... } (Razorpay order)

3. Client opens Razorpay checkout (SDK/redirect)
   → User completes payment on Razorpay
   → Razorpay returns: { razorpay_order_id, razorpay_payment_id, razorpay_signature }

4. Client sends payment result to backend:
   POST /api/razorpay/verify-payment
   Body: {
     orderId: "order_xxx",              // Razorpay order ID
     paymentId: "pay_xxx",              // Razorpay payment ID
     signature: "xxx",                  // Razorpay signature
     firestoreOrderId: "<orderId>"      // MongoDB document ID
   }

5. Backend verifies:
   a. Computes HMAC-SHA256("order_xxx|pay_xxx", RAZORPAY_SECRET)
   b. Compares with provided signature
   c. If invalid → mark failed, return 400
   d. If valid and status === -1 (first time):
      - Update order: status=2, paymentVerified=true, paymentStatus="SUCCESS"
      - Store paymentDetails: { orderId, paymentId, signature, verifiedAt }
      - KitchenService.addOrderItems(order)
      - emitKitchenUpdate(snapshot)
      → Return { success: true }

6. Kitchen receives real-time update via Socket.IO
```

### Happy Path — Pickup Later

Same as above, but step 5d differs:
- Update order: status=1, kitchenScheduledAt = pickupTime - 15min
- If kitchenScheduledAt already passed → immediately promote to status=2 and add to kitchen
- KitchenScheduler (30s interval) will later promote status 1→2 when scheduled time arrives

### Payment Failure Flow

```
1-3. Same as happy path

4. Razorpay checkout reports failure (or user cancels)

5. Client reports failure:
   POST /api/razorpay/payment-failed
   Body: { firestoreOrderId: "<orderId>", reason: "payment_failed" }

6. Backend marks:
   - status: 6 (payment failed)
   - paymentVerified: false
   - paymentFailure: { reason, failedAt }
```

### Cancellation + Refund Flow

```
1. Client requests cancellation:
   POST /api/razorpay/cancel-order
   Body: { orderId: "<orderId>" }   // This is the MongoDB _id

2. Backend:
   a. Fetches order
   b. If already cancelled → skip
   c. Sets status: 5
   d. If payment not verified → no refund needed
   e. If refund already processed → skip
   f. Marks refundStatus: "PROCESSING"
   g. Calls Razorpay refund API: payments.refund(paymentId, { amount: total*100 })
   h. Updates refund status (SUCCESS or FAILED)
```

### Critical Flow Observations

1. **Frontend success IS trusted** — the backend does not independently poll Razorpay to confirm payment. It relies on the client's payment result.
2. **No webhook fallback** — if the client crashes after Razorpay success but before calling verify, the payment is lost.
3. **No amount verification** — the backend does not verify that the amount paid matches the order total. It only verifies the signature.
4. **Database status is authoritative** for kitchen operations but not for payment confirmation from Razorpay's perspective.
5. **The `firestoreOrderId` is the link** between the Razorpay order and the MongoDB document — it's passed as the `receipt` in Razorpay order creation and used to look up the order for verification.

---

## 13. Payment API Inventory

| Method | Endpoint | Purpose | Auth Required | Request Body | Response | Database Changes | External API Calls | Controller File |
|---|---|---|---|---|---|---|---|---|
| POST | `/api/razorpay/create-order` | Create Razorpay order | No | `{ amount: number, firestoreOrderId: string }` | `{ success: true, order: <Razorpay order> }` | None | `razorpayInstance.orders.create()` | `razorpay.controller.js:4` |
| POST | `/api/razorpay/verify-payment` | Verify payment signature & update order | No | `{ orderId: string, paymentId: string, signature: string, firestoreOrderId: string }` | `{ success: true }` or 400 | Order status updated (1 or 2), paymentVerified, paymentStatus, paymentDetails, kitchenScheduledAt | None (verification is local) | `razorpay.controller.js:21` |
| POST | `/api/razorpay/payment-failed` | Mark order payment as failed | No | `{ firestoreOrderId: string, reason?: string }` | `{ success: true }` | Order status=6, paymentFailure | None | `razorpay.controller.js:52` |
| POST | `/api/razorpay/cancel-order` | Cancel order and process refund | No | `{ orderId: string }` | `{ cancelled: true, refund: "SUCCESS"|"FAILED"|"NOT_REQUIRED"|"ALREADY_PROCESSED" }` | Order status=5, refundStatus, refundId | `razorpayInstance.payments.refund()` | `razorpay.controller.js:72` |

---

## 14. Kitchen & Scheduling System

### KitchenService (`src-ts/services/KitchenService.ts`)

Manages a `kitchen_items` collection:
- **addOrderItems**: Upserts items with quantity increments and allocation tracking
- **decrementItem**: FIFO consumption of allocated quantities, triggers AllocationEngine
- **getSnapshot**: Returns all items with positive quantity
- **clearItem**: Removes a kitchen item entirely

### KitchenScheduler (`src-ts/services/KitchenScheduler.ts`)

- Runs on 30-second interval
- Ensures index on `{ status: 1, kitchenScheduledAt: 1 }`
- Promotes orders from status 1 (Accepted) to status 2 (In making) when `kitchenScheduledAt <= now`
- Adds items to kitchen and notifies customer via FCM

### AllocationEngine (`src-ts/services/AllocationEngine.ts`)

- Tracks `fulfilledQty` per item per order
- When all items are fulfilled and status was 2, promotes to status 3 (Ready to pick)
- Sends "Ready to pick" FCM notification

### Order Status Flow

```
-1 (Not paid)
  → 2 (In making)         [pickup now, payment verified]
  → 1 (Accepted)          [pickup later, payment verified]
    → 2 (In making)       [KitchenScheduler promotes when scheduled time arrives]
      → 3 (Ready to pick) [AllocationEngine when all items fulfilled]
        → 4 (Picked up)   [manual/external — not set by backend code]
  → 5 (Cancelled)         [cancel-order endpoint or kitchen clear]
  → 6 (Payment failed)    [payment-failed endpoint]
```

---

## 15. Notifications (FCM)

**File:** `src/services/fcm.service.js`

Uses Firebase Admin SDK to send push notifications via FCM:
- `sendNotificationToTokens(tokens, title, body, data)` — multicast to token array
- Uses `admin.messaging().sendEachForMulticast()`

**Triggers:**
- New order → admin notification (via `POST /api/notify/new-order`)
- Order status change → customer notification (via `POST /api/notify/order-status`)
- KitchenScheduler → customer "being prepared" notification
- AllocationEngine → customer "ready to pick" notification

**Token sources:**
- Admin tokens: `users` collection where `type: 1` and `fcmToken` exists
- Customer token: `fcm` field on the order document

---

## 16. Reporting System

**Endpoint:** `POST /reports/generate`

Four report types available:

| Report Type | Function | Description |
|---|---|---|
| `total_sales` | `totalSales.report.js` | Gross total, CGST (2.5%), SGST (2.5%), net total |
| `transaction_history` | `transactionHistory.report.js` | Per-order transaction list with timestamps |
| `student_transaction_record` | `studentTransactionRecord.report.js` | Transaction history enriched with student names |
| `stock_sold` | `stockSold.report.js` | Product-wise quantity sold |

All reports query `OrderHistory` with `status: 4` (picked up / completed) within a date range.

---

## 17. Socket.IO / Real-Time

**File:** `src-ts/socket/SocketGateway.ts`

- Single room: `kitchen-room`
- Clients emit `joinKitchen` to join the room
- Server emits `kitchen_update` with kitchen snapshot data
- Triggered after: payment verification (pickup now), KitchenScheduler promotions, kitchen decrement/clear operations

---

## 18. Security Analysis

| Aspect | Finding |
|---|---|
| **Secrets storage** | Environment variables via `dotenv`. `.env` is gitignored. |
| **Backend-only secrets** | `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET` are backend-only (not sent to client). |
| **Payment signature verification** | Implemented server-side using HMAC-SHA256. |
| **Webhook signature verification** | Not implemented — no webhook endpoint exists. |
| **Request authentication** | **NONE** on all payment endpoints. |
| **Payment amount trusted from frontend** | **YES** — the amount passed to `createOrder` is taken directly from `req.body.amount` with no server-side validation against order total. |
| **Order ownership validated** | **NO** — any caller can reference any `firestoreOrderId`. |
| **Payment IDs validated** | Signature is verified against Razorpay secret, but no check that the payment actually belongs to the order beyond what the signature implies. |
| **Duplicate payment prevention** | Partial — `verifyPayment` checks `order.status !== -1` to prevent double-processing, but this check relies on the database being consistent. |
| **Webhook replay/idempotency** | N/A — no webhooks. |
| **Sensitive data logging** | Refund errors are logged (`console.log("Refund Error:", error)`). Payment IDs are not explicitly logged in normal flow. |
| **HTTPS** | Not configured in the backend. Assumed to be handled by reverse proxy/deployment platform. |
| **CORS** | Wide open: `app.use(cors())` with no configuration — allows all origins. |
| **Rate limiting** | **NONE**. |
| **Input validation** | **NONE** beyond checking required fields are present (`!amount \|\| !firestoreOrderId`). No type checking, range validation, or sanitization. |
| **Error exposure** | Generic error messages returned to client (`"Failed to create order"`, `"Payment verification failed"`). Stack traces logged to server console only. |
| **Timing-safe comparison** | **NOT USED** for signature verification — uses `!==` instead of `crypto.timingSafeEqual()`. |

### Hardcoded Secrets Check

No hardcoded secrets were found in the source code. All secrets are loaded from environment variables.

---

## 19. Environment Variables

All environment variable **names** referenced in the codebase:

### Payment (Razorpay)
| Variable | Used In | Purpose |
|---|---|---|
| `RAZORPAY_KEY_ID` | `src/config/razorpay.js:5` | Razorpay API key ID |
| `RAZORPAY_SECRET` | `src/config/razorpay.js:6`, `src/services/razorpay.service.js:98` | Razorpay API key secret (also used for HMAC signing) |

### Database
| Variable | Used In | Purpose |
|---|---|---|
| `MONGODB_URI` | `dist/config/mongodb.js:7` | MongoDB connection string |

### Firebase
| Variable | Used In | Purpose |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `src/config/firebase.js:6` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | `src/config/firebase.js:7` | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | `src/config/firebase.js:8` | Firebase service account private key |

### Appwrite
| Variable | Used In | Purpose |
|---|---|---|
| `APPWRITE_ENDPOINT` | `src-ts/controller/account.controller.ts:6`, `password.controller.ts:8` | Appwrite API endpoint |
| `APPWRITE_PROJECT_ID` | `src-ts/controller/account.controller.ts:7`, `password.controller.ts:9` | Appwrite project ID |
| `APPWRITE_API_KEY` | `src-ts/controller/account.controller.ts:8`, `password.controller.ts:10` | Appwrite server-side API key |

### Application
| Variable | Used In | Purpose |
|---|---|---|
| `PORT` | `server.js:55` | Server listen port (default: 8080) |
| `INTERNAL_DELETE_SECRET` | `src-ts/controller/account.controller.ts:26` | Secret for account deletion endpoint |

### Email (Password Reset — currently disabled)
| Variable | Used In | Purpose |
|---|---|---|
| `BASE_URL` | `src-ts/controller/password.controller.ts:27` | Base URL for password reset links |
| `MAIL_USER` | `src-ts/controller/password.controller.ts:33` | SMTP email user |
| `MAIL_PASS` | `src-ts/controller/password.controller.ts:34` | SMTP email password |

---

## 20. HDFC Migration-Relevant Inventory

### KEEP / LIKELY UNCHANGED

| Component | File(s) | Reason |
|---|---|---|
| MongoDB connection | `dist/config/mongodb.js` | Gateway-independent |
| Order model/schema | `OrderHistory` collection structure | Payment fields are additive — existing fields remain valid |
| `MongoDatasource` CRUD operations | `src/services/datasource/MongoDatasource.js` | Generic — not payment-specific |
| Order status codes | Status -1 through 6 | Business logic, not gateway-specific |
| Kitchen system | `KitchenService`, `KitchenScheduler`, `AllocationEngine` | Triggered post-payment verification, gateway-independent |
| Socket.IO gateway | `SocketGateway.ts` | Broadcasts kitchen updates, not payment-specific |
| Notification system | `fcm.service.js`, `notification.controller.js` | Triggered by status changes, gateway-independent |
| Reports | `src/services/reports/*` | Read from `OrderHistory`, payment fields are additive |
| Generic data API | `src/routes/data.routes.js`, `src/controllers/data.controller.js` | CRUD operations, not payment-specific |
| Account management | `account.controller.ts` | Appwrite user management, not payment-specific |
| `BackendDatasource` abstraction | `src/services/datasource/BackendDatasource.js` | Interface, gateway-independent |

### REVIEW (Compatibility Must Be Checked)

| Component | File(s) | Why Review Needed |
|---|---|---|
| `OrderHistory` document structure | All files referencing order fields | HDFC may require additional fields (transaction IDs, status codes, timestamps). Must ensure existing fields remain compatible. |
| Order creation flow | Client → `PUT /api/doc/OrderHistory/:id` | The generic data endpoint currently allows unauthenticated writes. HDFC flow may require server-side order validation. |
| `isPaymentStatus` field | `src/models/OrderModel.js:16` | Legacy field — unclear if still used. Should verify before relying on it. |
| Amount handling | `razorpay.service.js:13` (`amount * 100`) | HDFC may use different currency units (paise vs rupees). Verify HDFC API requirements. |
| Receipt/reference handling | `razorpay.service.js:16` (`receipt: receiptId`) | HDFC may require different reference formats. |
| Signature verification | `razorpay.service.js:95-103` | HDFC will use a different signature algorithm. The pattern is reusable but the implementation must change. |
| Refund fields in order document | `razorpay.service.js:44-90` | HDFC refund API will differ. Existing refund fields may need updating or supplementing. |
| `paymentDetails` object shape | `razorpay.service.js:126-130` | Currently stores `{ orderId, paymentId, signature, verifiedAt }`. HDFC may return different fields. |

### LIKELY MODIFY

| Component | File(s) | What Will Change |
|---|---|---|
| Razorpay SDK initialization | `src/config/razorpay.js` | Replace with HDFC SDK/client initialization |
| `razorpay` npm package | `package.json` | Replace or supplement with HDFC SDK |
| `RAZORPAY_KEY_ID` / `RAZORPAY_SECRET` | `src/config/razorpay.js:5-6` | Replace with HDFC credentials |
| `createOrder` service method | `src/services/razorpay.service.js:12-18` | Replace with HDFC order/payment creation API |
| `verifyPayment` service method | `src/services/razorpay.service.js:93-194` | Replace signature algorithm, possibly adjust verification logic |
| `cancelAndRefund` service method | `src/services/razorpay.service.js:20-91` | Replace with HDFC refund API |
| `markPaymentFailed` | `src/services/razorpay.service.js:197-221` | May need adjustment for HDFC error codes |
| Route file | `src/routes/razorpay.routes.js` | Rename/refactor to reflect new gateway |
| Controller file | `src/controllers/razorpay.controller.js` | Rename/refactor to reflect new gateway |
| Environment variables | `.env` | Add HDFC credentials, potentially deprecate Razorpay vars |
| `package.json` dependencies | `package.json` | Add HDFC SDK, potentially remove `razorpay` |

### POTENTIALLY ADD

| Feature | Rationale |
|---|---|
| **Webhook endpoint** | HDFC Collect Now likely requires server-to-server callbacks. The current system has no webhook handler — this is a critical gap. |
| **Payment status inquiry** | HDFC may require polling for payment status. No such mechanism exists currently. |
| **Server-side amount validation** | Currently the amount from `req.body.amount` is trusted. Should validate against `order.overallTotal` from MongoDB. |
| **Webhook signature verification** | HDFC webhooks will need signature verification (similar to Razorpay's but different algorithm). |
| **Idempotency keys** | For retry safety on HDFC API calls. No such mechanism exists. |
| **Payment state machine** | A formal state machine for payment status transitions would improve reliability. Currently ad-hoc. |
| **Audit logging** | Payment operations are only logged via `console.error`. A structured audit trail would be valuable. |
| **Timeout handling** | No timeout handling for payment status — if neither success nor failure is reported, the order stays in limbo. |
| **Rate limiting** | No rate limiting on any endpoints. Should be added for payment endpoints at minimum. |
| **Authentication middleware** | No auth on payment endpoints. Should be added to prevent unauthorized order manipulation. |
| **Request validation** | No input validation library. Should validate amounts, order IDs, and field types. |

---

## 21. Summary

### A. Current Backend Architecture

The backend is a Node.js/Express application using ES Modules with a mixed JavaScript/TypeScript codebase. It serves a campus cafeteria system with order management, kitchen tracking, real-time updates (Socket.IO), push notifications (FCM), and reporting. The application uses MongoDB (native driver, no ODM) for data persistence and Appwrite for user account management.

### B. Current Payment Architecture

The payment system is Razorpay-only, using the Razorpay Orders API. The backend creates Razorpay orders, verifies payment signatures server-side, handles payment failure reporting, and processes refunds. There is no webhook handler — all payment state transitions are driven by the Flutter client calling backend endpoints. The payment flow relies entirely on the client to report payment results.

### C. Payment-Related Files

| File | Purpose |
|---|---|
| `src/config/razorpay.js` | Razorpay SDK client singleton |
| `src/services/razorpay.service.js` | Payment business logic (create, verify, refund, fail) |
| `src/controllers/razorpay.controller.js` | HTTP handlers for payment endpoints |
| `src/routes/razorpay.routes.js` | Route definitions |
| `src/services/datasource/MongoDatasource.js` | Order read/write (getOrderById, updateOrderStatus) |
| `server.js` | Mounts `/api/razorpay` routes |

### D. Current Razorpay Flow

```
Flutter → POST /create-order → Node.js → Razorpay Orders API → order_id
  → Flutter → Razorpay Checkout → payment result
  → Flutter → POST /verify-payment → Node.js → HMAC verification → MongoDB update
  → Flutter → POST /payment-failed (on failure) → Node.js → MongoDB status=6
  → Admin → POST /cancel-order → Node.js → Razorpay Refund API → MongoDB refund status
```

### E. Database Payment State

**Before payment:**
- Order exists in `OrderHistory` with `status: -1`, no payment fields set
- Order created by client via generic `PUT /api/doc/OrderHistory/:id`

**After success:**
- `status: 2` (pickup now) or `status: 1` (pickup later)
- `paymentVerified: true`
- `paymentStatus: "SUCCESS"`
- `razorpayPaymentId: "<pay_xxx>"`
- `refundStatus: "NONE"`
- `paymentDetails: { orderId, paymentId, signature, verifiedAt }`

**After failure:**
- `status: 6`
- `paymentVerified: false`
- `paymentFailure: { reason, failedAt }`

**For pending/unknown payments:**
- Order remains at `status: -1`
- No payment fields set
- **No mechanism to reconcile** — if client fails to report, the order is stuck

### F. Current Verification Mechanism

- HMAC-SHA256 signature verification using `RAZORPAY_SECRET`
- Algorithm: `HMAC("orderId|paymentId", secret)`
- Compared using strict equality (`!==`) — **not timing-safe**
- No server-side confirmation with Razorpay API (e.g., fetching payment details)
- No amount verification against order total

### G. Current Webhook Mechanism

**Not implemented.** There is no webhook endpoint in the backend. Razorpay webhooks are not configured or handled. This is the most significant gap in the current payment architecture.

### H. Important Findings

1. **No authentication** on any payment endpoint —任何人 can create orders, trigger verification, and cancel orders
2. **No webhook handler** — payment reconciliation depends entirely on the client
3. **Amount not validated server-side** — `req.body.amount` is trusted without checking against order total
4. **No timing-safe comparison** for signature verification
5. **Generic data API** allows unauthenticated writes to any MongoDB collection — orders are created this way
6. **Mixed codebase complexity** — `src/` (JS) and `src-ts/` (TS → `dist/`) cross-reference each other
7. **Legacy code present** — `FirebaseDatasource.js`, `firestore.service.js`, `OrderModel.js` appear to be leftover from a Firestore migration and are not used in the main payment flow
8. **Password reset routes are commented out** — not active

### I. Unknowns / Areas That Could Not Be Determined

1. **How orders are initially created on the client side** — the backend only handles the generic `PUT /api/doc/OrderHistory/:id` but the full client-side order creation flow is not visible from backend code alone
2. **Razorpay webhook configuration** — whether webhooks are configured in the Razorpay dashboard but simply not handled by this backend
3. **Production deployment configuration** — CORS, rate limiting, HTTPS termination at reverse proxy level
4. **Whether `firestoreOrderId` naming reflects a historical Firestore → MongoDB migration** and whether all order references are consistent
5. **The exact shape of the order document as created by the client** — only fields used in backend code are documented here
6. **Whether `isPaymentStatus` (in `OrderModel.js`) is actively used** or is a legacy field
7. **Whether the `paymentMode` field on orders carries meaningful data** or is always empty

### J. HDFC Migration Touchpoints

The migration from Razorpay to HDFC Collect Now will primarily affect:

1. **Gateway SDK** — Replace `razorpay` npm package with HDFC SDK
2. **Configuration** — Replace `RAZORPAY_KEY_ID`/`RAZORPAY_SECRET` with HDFC credentials
3. **Order creation** — Replace `razorpayInstance.orders.create()` with HDFC payment initiation API
4. **Signature verification** — Replace HMAC-SHA256 with HDFC's verification mechanism
5. **Refund API** — Replace `razorpayInstance.payments.refund()` with HDFC refund API
6. **Webhook handler** — **Must be added** — HDFC Collect Now requires server-side callback handling
7. **Payment status inquiry** — May need to be added if HDFC requires polling
8. **Database fields** — `paymentDetails` object shape and refund fields may need updating

The kitchen system, notification system, reporting, socket.IO, and order lifecycle management are **gateway-independent** and should not require changes.

---

> **Document generated by analyzing the complete repository source code. No application source code was modified during this analysis.**
