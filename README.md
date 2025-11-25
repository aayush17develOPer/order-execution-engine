# Order Execution Engine

A high-performance, scalable order execution system built with Node.js, Fastify, BullMQ, PostgreSQL, and Redis. Features real-time WebSocket updates, concurrent order processing, and a live monitoring dashboard.

🔗 **Live Demo**: [https://order-execution-engine-production-f7e4.up.railway.app](https://order-execution-engine-production-f7e4.up.railway.app)

## 🚀 Features

- **Concurrent Order Processing**: Handle multiple orders simultaneously with BullMQ worker queues
- **Real-time Updates**: WebSocket connections for live order status tracking
- **RESTful API**: Clean, well-documented endpoints for order management
- **Database Persistence**: PostgreSQL with automatic migrations
- **Queue Management**: Redis-backed job queue with retry logic and backoff strategies
- **Live Dashboard**: Interactive web interface for testing and monitoring
- **Production Ready**: Deployed on Railway with environment-based configuration

## 📋 Table of Contents

- [Flow](#flow)
- [Tech Stack](#tech-stack)
- [Design Decisions](#design-decisions)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)

## 🏗️ Flow

1. **Client** submits order via REST API
2. **Fastify** validates and persists order to PostgreSQL
3. **BullMQ** queues job in Redis
4. **Worker** picks up job and processes order
5. **Events** emit status updates via WebSocket
6. **Client** receives real-time updates

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Fastify 4.x (high-performance web framework)
- **Queue**: BullMQ (Redis-based job queue)
- **Database**: PostgreSQL 15
- **Cache/Queue Storage**: Redis 7
- **Language**: TypeScript
- **Validation**: Zod
- **WebSockets**: @fastify/websocket

## 🎯 Design Decisions

### 1. Fastify over Express

- **Performance**: 2-3x faster than Express with native JSON parsing
- **Schema validation**: Built-in support with compile-time optimization
- **TypeScript**: First-class TypeScript support out of the box
- **Plugin architecture**: Clean, modular code organization with encapsulation

### 2. BullMQ for Job Queue

- **Reliability**: Redis-backed with automatic retries and exponential backoff
- **Scalability**: Horizontal scaling with multiple workers
- **Observability**: Built-in metrics and monitoring capabilities
- **Concurrency control**: Rate limiting and max concurrent jobs configuration

### 3. PostgreSQL for Orders

- **ACID compliance**: Ensures data consistency and reliability
- **Indexing**: Fast queries on status and timestamps for analytics
- **Migrations**: Automatic schema setup on deployment
- **Relational model**: Easy to extend with order history and relationships

### 4. Event-Driven Architecture

- **Decoupling**: Separation of concerns between services
- **Real-time**: WebSocket broadcasts for live updates to clients
- **Global stream**: Monitor all orders simultaneously
- **Scalability**: Easy to add more event listeners without code changes

### 5. TypeScript

- **Type safety**: Catch errors at compile time before deployment
- **Developer experience**: Better IDE support and autocomplete
- **Maintainability**: Self-documenting code with interfaces
- **Refactoring**: Safer refactoring with compile-time checks

## 📦 Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for local development)
- PostgreSQL 15+
- Redis 7+

### Local Development

1. **Clone the repository**

git clone https://github.com/yourusername/order-execution-engine.git
cd order-execution-engine

2. **Install dependencies**

npm install

3. **Set up environment variables**

cp .env.example .env

Edit `.env`:

NODE_ENV=development
PORT=3000

Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

PostgreSQL
DATABASE_URL=postgresql://orderengine:orderengine123@localhost:5432/orders_db

Order Processing
MAX_CONCURRENT_ORDERS=10
MAX_ORDERS_PER_MINUTE=100
MAX_RETRY_ATTEMPTS=3

DEX Settings
SLIPPAGE_TOLERANCE=0.01

4. **Start services with Docker Compose**

docker-compose up -d

This starts PostgreSQL and Redis containers.

5. **Build the application**

npm run build

6. **Start the server**

Development mode (with hot reload)
npm run dev

7. **Open the dashboard**

http://localhost:3000

## 🔌 API Documentation

### Base URL

- **Local**: `http://localhost:3000`
- **Production**: `https://order-execution-engine-production-f7e4.up.railway.app`

### Endpoints

#### POST `/api/orders/execute`

Create a new order

**Request Body:**

{
"orderType": "market",
"tokenIn": "SOL",
"tokenOut": "USDC",
"amountIn": 1.0,
"slippage": 0.01
}

**Response:**

{
"success": true,
"orderId": "abc-123-456",
"status": "pending",
"message": "Order created. Connect to WebSocket for live updates.",
"websocketUrl": "/api/orders/abc-123-456/stream"
}

---

#### GET `/api/orders/:orderId`

Get order details by ID

**Response:**
{
"success": true,
"order": {
"id": "abc-123-456",
"status": "completed",
"orderType": "market",
"tokenIn": "SOL",
"tokenOut": "USDC",
"amountIn": 1.0,
"slippage": 0.01,
"createdAt": "2025-11-25T12:00:00Z",
"updatedAt": "2025-11-25T12:00:05Z"
}
}

---

#### GET `/api/metrics`

Get queue and order statistics

**Response:**

{
"success": true,
"queue": {
"waiting": 5,
"active": 2,
"completed": 100,
"failed": 3,
"delayed": 0
},
"orders": {
"pending": 3,
"processing": 2,
"completed": 95,
"failed": 5,
"total": 105
},
"timestamp": "2025-11-25T12:00:00Z"
}

---

#### GET `/health`

Health check endpoint

**Response:**

{
"status": "healthy",
"timestamp": "2025-11-25T12:00:00Z"
}

---

### WebSocket Endpoints

#### WS `/api/orders/:orderId/stream`

Real-time updates for a specific order

**Connection:**

const ws = new WebSocket('wss://your-app.up.railway.app/api/orders/abc-123/stream');

ws.onmessage = (event) => {
const data = JSON.parse(event.data);
console.log(data);
};

**Message Format:**

{
"type": "status_update",
"orderId": "abc-123-456",
"status": "processing",
"data": {
"message": "Order being processed..."
},
"timestamp": "2025-11-25T12:00:00Z"
}

---

#### WS `/api/orders/stream/all`

Real-time updates for all orders

**Connection:**

const ws = new WebSocket('wss://your-app.up.railway.app/api/orders/stream/all');

ws.onmessage = (event) => {
const data = JSON.parse(event.data);
console.log(Order ${data.orderId}: ${data.status});
};

## 🚀 Deployment

### Railway Deployment

1. **Push to GitHub**

git add .
git commit -m "Initial commit"
git push origin main

2. **Create Railway project**

   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"

3. **Add PostgreSQL**

   - Click "New" → "Database" → "PostgreSQL"
   - Railway automatically sets `DATABASE_URL`

4. **Add Redis**

   - Click "New" → "Database" → "Redis"
   - Railway automatically sets `REDISHOST` and `REDIS_PASSWORD`

5. **Configure order-execution-engine service**
   - Click on your service
   - Go to "Variables" tab
   - Add environment variables:

NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_HOST=${{Redis.REDISHOST}}
REDIS_PORT=6379
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}
MAX_CONCURRENT_ORDERS=10
MAX_ORDERS_PER_MINUTE=100
MAX_RETRY_ATTEMPTS=3
SLIPPAGE_TOLERANCE=0.01

6. **Generate public domain**
   - Go to "Settings" → "Networking"
   - Click "Generate Domain"
   - Your app is now live!

## 🧪 Testing

### Using the Dashboard

1. Navigate to your deployment URL
2. Click "Test Health Endpoint" - should return healthy status
3. Create a single order with default values
4. Click "Connect to All Orders" to watch real-time updates
5. Click "Create 5 Orders (Concurrent)" to test concurrent processing
6. Watch the orders table update in real-time as they process

### Using cURL

**Health Check:**

curl https://order-execution-engine-production-f7e4.up.railway.app/health

**Create Order:**

curl -X POST https://order-execution-engine-production-f7e4.up.railway.app/api/orders/execute
-H "Content-Type: application/json"
-d '{
"orderType": "market",
"tokenIn": "SOL",
"tokenOut": "USDC",
"amountIn": 1.0,
"slippage": 0.01
}'

**Get Metrics:**

curl https://order-execution-engine-production-f7e4.up.railway.app/api/metrics

**Get Order:**

curl https://order-execution-engine-production-f7e4.up.railway.app/api/orders/YOUR_ORDER_ID

## 📁 Project Structure

order-execution-engine/
├── src/
│ ├── app.ts # Fastify server setup
│ ├── config/
│ │ ├── database.ts # PostgreSQL connection
│ │ ├── redis.ts # Redis connection
│ │ └── env.ts # Environment validation with Zod
│ ├── models/
│ │ └── order.model.ts # Order types and enums
│ ├── routes/
│ │ └── orders.route.ts # API endpoints and WebSocket
│ ├── services/
│ │ ├── order-execution.service.ts # Order business logic
│ │ ├── order-queue.service.ts # BullMQ queue management
│ │ └── order-events.service.ts # Event emitter for updates
│ ├── workers/
│ │ └── order.worker.ts # BullMQ worker processor
│ └── migrations/
│ └── setup.ts # Database schema and migrations
├── public/
│ └── index.html # Test dashboard UI
├── dist/ # Compiled TypeScript output
├── .env.example # Environment variables template
├── .gitignore
├── docker-compose.yml # Local PostgreSQL + Redis
├── package.json
├── tsconfig.json
└── README.md

## 🔒 Environment Variables

| Variable                | Description                  | Default       | Required |
| ----------------------- | ---------------------------- | ------------- | -------- |
| `NODE_ENV`              | Environment mode             | `development` | Yes      |
| `PORT`                  | Server port                  | `3000`        | No       |
| `DATABASE_URL`          | PostgreSQL connection string | -             | Yes      |
| `REDIS_URL`             | Redis URL (Heroku/Render)    | -             | No       |
| `REDIS_HOST`            | Redis hostname               | `localhost`   | Yes\*    |
| `REDIS_PORT`            | Redis port                   | `6379`        | No       |
| `REDIS_PASSWORD`        | Redis password               | `""`          | No       |
| `MAX_CONCURRENT_ORDERS` | Max concurrent jobs          | `10`          | No       |
| `MAX_ORDERS_PER_MINUTE` | Rate limit                   | `100`         | No       |
| `MAX_RETRY_ATTEMPTS`    | Job retry attempts           | `3`           | No       |
| `SLIPPAGE_TOLERANCE`    | DEX slippage tolerance       | `0.01`        | No       |

\* Required unless `REDIS_URL` is provided

## 🔧 Development Scripts

Install dependencies
npm install

Run in development mode with hot reload
npm run dev

Build TypeScript
npm run build

Start production server
npm start

Run linter
npm run lint

Run tests
npm test

## 📊 Performance

- **Throughput**: Handles 100+ orders per minute
- **Latency**: < 50ms API response time
- **Concurrency**: Configurable concurrent order processing
- **Scalability**: Horizontal scaling with multiple worker instances

## 🛡️ Security

- Environment variable validation with Zod
- Input validation on all endpoints
- SQL injection prevention with parameterized queries
- Rate limiting support via BullMQ
- HTTPS enforcement in production

## 📝 License

MIT

## 👤 Author

Aayush Joshi

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## ⭐ Show your support

Give a ⭐️ if this project helped you!
