# Day 2 — Transactions, Concurrency & Performance

## 1. Goal

Understand how PostgreSQL handles transactions, concurrent requests, row locking, performance, connection pools, and deadlocks in real backend systems.

## 2. Transactions

A transaction groups multiple database operations into one atomic unit.

```sql
BEGIN;

-- multiple operations

COMMIT;
```

If something fails:

```sql
ROLLBACK;
```

### Atomicity

Either all related operations succeed or none of them are applied.

Example:

```text
Create Order
     ↓
Create Order Item
     ↓
Reduce Stock
```

If reducing stock fails, the order and order item should also be rolled back.

## 3. COMMIT vs ROLLBACK

* **COMMIT**: permanently applies the transaction.
* **ROLLBACK**: cancels all changes made during the transaction.

### Important Observation

Rolled-back inserts can still create gaps in `SERIAL` IDs because PostgreSQL sequences are not rolled back.

Example:

```text
ID: 5
ROLLBACK
ID: 6
```

The missing ID does not mean data was deleted.

## 4. Row-Level Locking

`SELECT ... FOR UPDATE` locks selected rows until the transaction finishes.

```sql
BEGIN;

SELECT stock_quantity
FROM products
WHERE id = 1
FOR UPDATE;

COMMIT;
```

Another transaction trying to lock the same row must wait.

### Mental Model

```text
Transaction A
      ↓
Locks Product 1
      ↓
Transaction B tries Product 1
      ↓
B waits
      ↓
A COMMIT / ROLLBACK
      ↓
B gets the lock
```

This is useful when multiple users may update the same inventory or other shared resource.

## 5. Concurrency & Stock

A common backend problem:

```text
Two users buy the last product
          ↓
Both read stock = 1
          ↓
Both try to purchase
```

Without proper concurrency control, both requests could incorrectly succeed.

Transactions and row locking help coordinate access to shared rows.

## 6. Prisma Transactions

Prisma provides transaction support through `$transaction()`.

Example:

```ts
await prisma.$transaction(async (tx) => {
  const product = await tx.products.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  const order = await tx.orders.create({
    data: {
      user_id: userId,
      status: "pending",
    },
  });

  await tx.order_items.create({
    data: {
      order_id: order.id,
      product_id: productId,
      quantity,
      price_paise: product.price_paise,
    },
  });

  await tx.products.updateMany({
    where: {
      id: productId,
      stock_quantity: { gte: quantity },
    },
    data: {
      stock_quantity: { decrement: quantity },
    },
  });

  return order;
});
```

If an error occurs inside the transaction, Prisma rolls back the transaction.

### Important Backend Pattern

```text
Validate
   ↓
Read required data
   ↓
Create order
   ↓
Create order items
   ↓
Update inventory
   ↓
COMMIT
```

All operations belong to the same transaction when they must succeed or fail together.

## 7. Transaction Rollback Experiment

We intentionally added:

```ts
throw new Error("Simulated failure");
```

after creating the order item.

Result:

```text
Order created?       ❌
Order item created?  ❌
Stock changed?       ❌
```

The entire transaction was rolled back.

This demonstrated **atomicity in practice**.

## 8. EXPLAIN ANALYZE

`EXPLAIN ANALYZE` shows how PostgreSQL actually executed a query.

Example:

```sql
EXPLAIN ANALYZE
SELECT *
FROM orders
WHERE user_id = 1;
```

It helps identify:

* Sequential scans
* Index scans
* Number of rows examined
* Rows removed by filters
* Query execution time
* Query planning time

## 9. Sequential Scan vs Index

Without an index:

```text
Seq Scan
↓
Check many/all rows
↓
Find matching rows
```

With an index:

```text
Index
↓
Locate matching rows
↓
Fetch required rows
```

Our test with approximately 100,000 orders showed a major difference.

### Without Index

PostgreSQL performed a sequential scan and examined approximately 100,000 rows.

Execution time was around:

```text
5.346 ms
```

### With Index

PostgreSQL used:

```text
Bitmap Index Scan
        ↓
Bitmap Heap Scan
```

Execution time was around:

```text
0.128 ms
```

### Important Lesson

An index can dramatically reduce the amount of data PostgreSQL needs to scan for selective queries.

But indexes are not free:

* They consume storage.
* Inserts/updates become more expensive.
* Too many indexes can hurt write performance.

## 10. Connection Pool

A connection pool maintains a limited number of reusable PostgreSQL connections.

Instead of creating a new database connection for every request:

```text
API Request
    ↓
Connection Pool
    ↓
Existing DB Connection
    ↓
PostgreSQL
```

### Our Experiment

We configured:

```ts
max: 2
```

and sent 5 concurrent database operations.

Result:

```text
5 application requests
        ↓
2 database connections
        ↓
2 queries execute
        ↓
remaining queries wait
        ↓
connections become available
        ↓
next queries execute
```

We observed:

```text
Request 1 ────────┐
Request 2 ────────┤
                  │
Request 3 waits ──┤
Request 4 waits ──┤
Request 5 waits ──┘
```

### Important Concept

Application-level concurrency does not mean the database executes everything concurrently.

The connection pool limits how many database operations can use connections at the same time.

## 11. Connection Pool Exhaustion

We configured:

```ts
max: 2,
connectionTimeoutMillis: 1000
```

Each query intentionally held a connection for approximately 5 seconds using:

```sql
SELECT pg_sleep(5)::text;
```

With 5 concurrent requests:

```text
2 connections available
        ↓
Request 1 → connection
Request 2 → connection
        ↓
Requests 3, 4, 5 wait
        ↓
1 second timeout
        ↓
Requests 3, 4, 5 fail
```

We received:

```text
Error: timeout exceeded when trying to connect
```

### Production Causes

Pool pressure can happen because of:

* Slow queries
* Long-running transactions
* Too many concurrent requests
* Incorrect pool sizing
* Connections not being released properly

### Production Fixes

* Optimize slow queries.
* Add appropriate indexes.
* Keep transactions short.
* Avoid unnecessary work while holding a connection.
* Configure a sensible pool size.
* Configure connection timeouts.
* Monitor database latency and pool utilization.

## 12. Deadlocks

A deadlock happens when two transactions wait for each other indefinitely.

Our experiment:

```text
Transaction A                 Transaction B

Lock Product 1                Lock Product 2
      ↓                             ↓
Wait for Product 2            Wait for Product 1
      ↓                             ↓
      └──────── DEADLOCK ───────────┘
```

PostgreSQL detected the deadlock and returned:

```text
ERROR: deadlock detected
```

PostgreSQL automatically aborted one transaction so the database would not remain permanently stuck.

## 13. Preventing Deadlocks

The main fix we practiced was **consistent lock ordering**.

Bad:

```text
Transaction A:
Product 1 → Product 2

Transaction B:
Product 2 → Product 1
```

Good:

```text
Transaction A:
Product 1 → Product 2

Transaction B:
Product 1 → Product 2
```

Both transactions acquire locks in the same order.

The second transaction may wait, but there is no circular dependency.

### Other Deadlock Prevention Techniques

* Keep transactions short.
* Acquire locks in a consistent order.
* Avoid unnecessary locks.
* Avoid doing slow external work inside transactions.
* Handle deadlock errors and retry when appropriate.

## 14. Important Mental Models

### Transaction

```text
BEGIN
  ↓
Operations
  ↓
Success → COMMIT
Failure → ROLLBACK
```

### Row Lock

```text
Transaction A
     ↓
Locks row
     ↓
Transaction B waits
     ↓
A finishes
     ↓
B continues
```

### Connection Pool

```text
Requests
   ↓
Connection Pool
   ↓
Limited DB Connections
   ↓
PostgreSQL
```

### Deadlock

```text
A waits for B
B waits for A
     ↓
DEADLOCK
     ↓
PostgreSQL aborts one
```

## 15. Mistakes / Problems I Encountered

* Initially used `SELECT pg_sleep(5)` with Prisma, which returned PostgreSQL's `void` type and caused a Prisma deserialization error.
* Fixed it with:

```sql
SELECT pg_sleep(5)::text AS sleep_result;
```

* Initially tried `connection_limit=2` in the database URL, but because the project uses Prisma 7 with `@prisma/adapter-pg`, the actual pool was controlled through the `PrismaPg` adapter.
* Fixed the pool configuration with:

```ts
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
```

* Learned that a full connection pool does not automatically mean an error; requests can wait until a connection becomes available.
* Added `connectionTimeoutMillis` to intentionally demonstrate actual pool exhaustion.
* Created a real PostgreSQL deadlock using two database connections.

## 16. Backend Connection

These concepts directly appear in real backend systems:

```text
API Request
    ↓
Service
    ↓
Database Transaction
    ↓
Connection Pool
    ↓
PostgreSQL
    ↓
Locks / Indexes / Queries
```

Examples:

* E-commerce checkout → transaction + row locking
* Inventory → concurrency control
* Banking → transactions
* High-traffic APIs → connection pools
* Slow dashboards → indexes + EXPLAIN ANALYZE
* Concurrent updates → locking
* Complex transactions → deadlock prevention

## 17. Practice Questions

1. Why do we use transactions?
2. What is the difference between COMMIT and ROLLBACK?
3. Why can PostgreSQL `SERIAL` IDs have gaps?
4. What does `SELECT ... FOR UPDATE` do?
5. How can row locking prevent overselling inventory?
6. What does `EXPLAIN ANALYZE` tell us?
7. What is the difference between a sequential scan and an index scan?
8. Why shouldn't we blindly add indexes everywhere?
9. What is a database connection pool?
10. What happens when all connections in the pool are busy?
11. What causes connection pool exhaustion?
12. What is a deadlock?
13. How did we intentionally create a deadlock?
14. How can consistent lock ordering prevent deadlocks?
15. Why should database transactions be kept short?

## 18. Day 2 Status

* [x] Transactions
* [x] COMMIT / ROLLBACK
* [x] Transaction atomicity
* [x] Sequence gaps
* [x] Row-level locking
* [x] `SELECT ... FOR UPDATE`
* [x] Concurrent transactions
* [x] Prisma `$transaction()`
* [x] Transaction rollback experiment
* [x] `EXPLAIN ANALYZE`
* [x] Sequential scan
* [x] Index scan
* [x] Index performance comparison
* [x] Connection pools
* [x] Pool contention
* [x] Pool exhaustion
* [x] Connection timeout
* [x] Deadlock reproduction
* [x] Deadlock resolution
* [x] Consistent lock ordering
