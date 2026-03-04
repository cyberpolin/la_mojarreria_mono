src/
├─ keystone/
│ ├─ keystone.ts
│ │ └─ Keystone config
│ │ (db, auth, session, lists export)
│ │
│ ├─ lists/ ← DATA MODEL (NOUNS)
│ │ ├─ User.ts
│ │ ├─ Product.ts
│ │ ├─ Order.ts
│ │ ├─ OrderItem.ts
│ │ ├─ Payment.ts
│ │ └─ DailyClose.ts
│ │
│ │ Rules:
│ │ - fields
│ │ - access control
│ │ - lightweight hooks only
│ │
│ ├─ graphql/ ← API LAYER (VERBS)
│ │ ├─ schema.ts (extendGraphqlSchema)
│ │ │
│ │ ├─ mutations/
│ │ │ ├─ placeOrder.ts
│ │ │ ├─ addOrderItem.ts
│ │ │ ├─ closeOrder.ts
│ │ │ └─ closeDay.ts
│ │ │
│ │ └─ queries/
│ │ ├─ kitchenQueue.ts
│ │ └─ salesSummary.ts
│ │
│ │ Rules:
│ │ - thin resolvers
│ │ - authorization at boundary
│ │ - call domain services
│ │
│ └─ access/
│ ├─ roles.ts
│ └─ index.ts
│
├─ domain/ ← BUSINESS LOGIC
│ ├─ orders/
│ │ ├─ service.ts (placeOrder, totals, invariants)
│ │ └─ types.ts
│ │
│ ├─ sales/
│ │ └─ service.ts (reports, summaries)
│ │
│ └─ inventory/
│ └─ service.ts
│
│ Rules:
│ - no GraphQL
│ - no Keystone types
│ - testable, deterministic
│
├─ infra/ ← TECHNICAL DETAILS
│ ├─ db/
│ │ └─ prisma.ts (optional)
│ ├─ logging/
│ └─ errors/
│
└─ lib/ ← SHARED UTILITIES
├─ auth.ts
├─ money.ts
├─ validate.ts
└─ idempotency.ts
