# Day 3 — Prisma ORM, CRUD & Transactions

## 1. Goal

Learn how to use Prisma with PostgreSQL to perform CRUD operations, query related records, shape API responses, handle missing records, and execute multiple database writes safely using transactions.

## 2. Prisma Setup

Our project uses Prisma 7 with PostgreSQL and the `@prisma/adapter-pg` adapter.

Important commands:

```bash
pnpm exec prisma validate
pnpm exec prisma generate
```

- `prisma validate` checks whether the Prisma schema is valid.
- `prisma generate` generates the Prisma Client used to query the database.
- `prisma db pull` introspects an existing database and updates the Prisma schema to reflect its structure.

### Important Prisma 7 Detail

The project uses a PostgreSQL adapter and a generated client:

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma = new PrismaClient({ adapter });
```

The generated client and adapter must be configured correctly before running queries.

## 3. CRUD Operations

CRUD stands for Create, Read, Update, and Delete.

| Operation                  | Prisma method  | Purpose                               |
| -------------------------- | -------------- | ------------------------------------- |
| Create                     | `create()`     | Insert one record                     |
| Read one unique record     | `findUnique()` | Find by a unique field                |
| Read matching records      | `findMany()`   | Return an array of records            |
| Read first matching record | `findFirst()`  | Return one matching record            |
| Update                     | `update()`     | Update one uniquely identified record |
| Delete                     | `delete()`     | Delete one uniquely identified record |

### Create

```ts
const newUser = await prisma.users.create({
  data: {
    name: 'CRUD Test',
    email: 'crud-test@example.com',
  },
});
```

### Read

```ts
const users = await prisma.users.findMany({
  select: {
    id: true,
    name: true,
    email: true,
  },
  orderBy: {
    id: 'asc',
  },
  take: 5,
});
```

### Update

```ts
const updatedUser = await prisma.users.update({
  where: { id: 10007 },
  data: { name: 'CRUD Test Updated' },
});
```

### Delete

```ts
const deletedUser = await prisma.users.delete({
  where: { id: 10007 },
});
```

### Important Differences

- `update()` and `delete()` throw an error if the uniquely identified record does not exist.
- `updateMany()` and `deleteMany()` operate on all matching records and return a count.
- `findMany()` returns an array, even if no records match. In that case, the array is empty.
- `findUnique()` returns `null` when no matching record exists.
- `findFirst()` returns one matching record or `null`. Use `orderBy` when the intended first record matters.

## 4. Filtering, Sorting, Limiting & Selecting

These options are commonly used when building API endpoints.

```ts
const firstThree = await prisma.orders.findMany({
  where: {
    status: 'completed',
  },
  orderBy: {
    created_at: 'desc',
  },
  take: 3,
  select: {
    id: true,
    status: true,
    created_at: true,
  },
});
```

What each option does:

- `where` filters matching records.
- `orderBy` determines result ordering.
- `take` limits the number of returned records.
- `select` specifies which fields are returned.

### Important Observation

Sorting by `created_at: "desc"` returns the newest timestamps first. If several records have the same timestamp, add `id: "desc"` as a tie-breaker for deterministic ordering.

```ts
orderBy: [{ created_at: 'desc' }, { id: 'desc' }];
```

**Backend lesson:** Filter, sort, limit, and select data at the database-query level instead of fetching unnecessary records and processing everything in application code.

## 5. `include` vs `select`

### `include`

Returns all fields of the parent record by default, plus the requested related records.

```ts
const user = await prisma.users.findUnique({
  where: { id: 1 },
  include: {
    orders: true,
  },
});
```

### `select`

Returns only the fields and relations explicitly selected.

```ts
const user = await prisma.users.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    name: true,
    orders: {
      select: {
        id: true,
        status: true,
      },
    },
  },
});
```

### Important Rules

- Use `include` when you want all parent fields plus related data.
- Use `select` when you need precise control over returned fields.
- You can nest `select` inside relations to shape data at every level.
- Prisma does not allow `select` and `include` together at the same query level.

**Backend lesson:** Prefer explicit field selection for API responses when you know exactly what the endpoint needs. This helps avoid returning unnecessary data.

## 6. Querying Related Records

Our database relationship chain:

```text
users
  |
  └── orders
        |
        └── order_items
              |
              └── products
```

We queried a user's order history with nested selections.

```ts
const userOrderHistory = await prisma.users.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    name: true,
    orders: {
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 5,
      select: {
        id: true,
        status: true,
        created_at: true,
        order_items: {
          select: {
            quantity: true,
            price_paise: true,
            products: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    },
  },
});
```

This query retrieves:

- The user's ID and name.
- The five most recent orders.
- Each order's status and creation time.
- The items belonging to each order.
- Each item's quantity, recorded purchase price, and product details.

### Important Observation

Some orders returned:

```ts
order_items: [];
```

This is valid. It means those orders currently have no associated order items.

### Purchase-Time Price

`order_items.price_paise` records the price associated with the purchase. It should not automatically be replaced with the product's current price when displaying historical orders.

For example, if a keyboard costs ₹2,500 at purchase time and its price later increases to ₹3,000, the historical order should still show ₹2,500 per item.

## 7. Handling Missing Records

A query such as:

```ts
const user = await prisma.users.findUnique({
  where: { id: 999999 },
});
```

returns `null` when the user does not exist.

Always handle this before accessing the record's properties.

```ts
if (!user) {
  console.log('User not found');
} else {
  console.log(user.name);
}
```

Without the check, accessing `user.name` when `user` is `null` causes a runtime error.

### Backend Connection

In a real API, the same condition would normally result in an HTTP `404 Not Found` response.

```text
Request: GET /users/999999
             |
             v
      Query the database
             |
       +-----+-----+
       |           |
    Found       Not found
       |           |
      200         404
```

The actual HTTP response is handled by the API framework or controller, not by Prisma itself.

## 8. Prisma Transactions

A transaction groups multiple database operations into one atomic unit.

Our checkout exercise performs three related writes:

```text
Create Order
     |
     v
Create Order Item
     |
     v
Decrease Product Stock
     |
     v
   COMMIT
```

All operations must succeed together. If an operation fails, the transaction should roll back.

### Prisma Transaction Syntax

```ts
await prisma.$transaction(async (tx) => {
  // Perform related database operations using tx.
});
```

Use the transaction client `tx` for database operations inside the callback.

### Our Checkout Transaction

```ts
await prisma.$transaction(async (tx) => {
  const product = await tx.products.findUnique({
    where: { id: 1 },
  });

  if (!product || product.stock_quantity < 1) {
    throw new Error('Product not found or out of stock');
  }

  const order = await tx.orders.create({
    data: {
      user_id: 1,
      status: 'pending',
    },
  });

  await tx.order_items.create({
    data: {
      order_id: order.id,
      product_id: product.id,
      quantity: 1,
      price_paise: product.price_paise,
    },
  });

  await tx.products.update({
    where: { id: product.id },
    data: {
      stock_quantity: { decrement: 1 },
    },
  });
});
```

### Important Concepts

- `await` ensures each operation completes before the next operation uses its result.
- `order.id` is the ID generated for the newly created order.
- `product.price_paise` uses the price fetched from the database.
- `decrement: 1` reduces stock by one.
- Throwing an error inside the transaction aborts it and rolls back its database writes.
- The transaction callback should use `tx`, not the root `prisma` client, for operations that must be part of the same transaction.

## 9. Transaction Rollback Experiment

We deliberately inserted an error after the database writes:

```ts
throw new Error('Testing rollback');
```

We then ran the script and checked the database.

Expected result:

```text
Order created by failed run?       No
Order item created by failed run?  No
Stock changed by failed run?       No
```

The writes from the failed transaction were rolled back.

After testing, we removed the deliberate error and restored the successful transaction version.

**Important distinction:** Earlier successful transactions remain committed. Rollback only undoes the changes made by the transaction that failed.

## 10. Production Caveat — Concurrent Stock Updates

Our exercise checks stock and then decrements it:

```text
Read stock
    |
Check stock > 0
    |
Create order and item
    |
Decrement stock
```

This demonstrates transaction structure, but the stock check and decrement are separate operations.

Two concurrent transactions could both read `stock_quantity = 1` before either decrements it. A transaction alone does not automatically prevent this race.

### Production Improvement

Use an atomic conditional update that decrements stock only when sufficient stock remains, and verify that exactly one row was updated.

Conceptually:

```sql
UPDATE products
SET stock_quantity = stock_quantity - 1
WHERE id = 1
  AND stock_quantity >= 1;
```

If zero rows are updated, the product is unavailable or has insufficient stock. The application must treat this as a failed purchase and roll back the transaction.

**Lesson:** Transactions provide atomicity, but concurrent correctness also requires appropriate locking or atomic conditional updates.

## 11. Prisma Migrations — Quick Reference

We reviewed the migration workflow but did not perform a new schema migration during this session.

### `prisma migrate dev`

Creates and applies a development migration and maintains migration history.

```bash
pnpm exec prisma migrate dev --name add_user_phone
```

Use this when changing the Prisma schema through a version-controlled migration workflow.

### `prisma db push`

Synchronizes the Prisma schema with the database without creating a migration file.

```bash
pnpm exec prisma db push
```

Useful for prototyping, but it does not replace migration history for a team or production deployment workflow.

### Key Difference

| Command       | Updates database | Creates migration history |
| ------------- | ---------------- | ------------------------- |
| `migrate dev` | Yes              | Yes                       |
| `db push`     | Yes              | No                        |

## 12. Important Mental Models

### CRUD

```text
Create -> Read -> Update -> Delete
```

### Nested Relations

```text
User
 |
 Orders
 |
 Order Items
 |
 Products
```

### Query Shaping

```text
Filter (where)
    |
Sort (orderBy)
    |
Limit (take)
    |
Select required fields
    |
Return API data
```

### Transaction

```text
BEGIN
  |
Create order
  |
Create item
  |
Update stock
  |
  +---- Success ----> COMMIT
  |
  +---- Error ------> ROLLBACK
```

### Missing Record

```text
findUnique()
    |
    +---- Record found ----> Object
    |
    +---- Not found -------> null
```

## 13. Mistakes / Lessons Learned

- Initially queried `users` when the task required querying `orders`. The model must match the entity being retrieved.
- Learned that `include` returns all parent fields by default, while `select` controls which fields are returned.
- Learned that nested `select` can shape data through multiple relation levels.
- Learned that `findUnique()` returns `null` when no record matches, so the result must be checked.
- Learned that `findMany()` returns an array and that `take` limits its size.
- Learned to use `await` and store created records so their generated IDs can be used in subsequent operations.
- Learned to use the transaction client `tx` for all operations that must commit or roll back together.
- Learned that transaction atomicity alone does not eliminate every concurrency race, such as simultaneous purchases of the last item.

## 14. Backend Connection

These skills map directly to backend API development:

| API requirement            | Prisma concept                             |
| -------------------------- | ------------------------------------------ |
| List users                 | `findMany()`                               |
| Fetch a user by ID         | `findUnique()`                             |
| Update a user              | `update()`                                 |
| Return recent orders       | `where`, `orderBy`, `take`                 |
| Return order history       | Nested `select`                            |
| Handle an unknown ID       | Check for `null`; return 404               |
| Place an order             | `$transaction()`                           |
| Prevent overselling        | Atomic stock update or appropriate locking |
| Evolve the database schema | Migrations                                 |

## 15. Practice Questions

1. What is Prisma, and how does it interact with PostgreSQL?
2. What is the difference between `findUnique()`, `findFirst()`, and `findMany()`?
3. What is the difference between `include` and `select`?
4. What do `where`, `orderBy`, and `take` do?
5. Why does `findUnique()` require missing-record handling?
6. How do nested relations work in Prisma?
7. Why should order items store the purchase-time price?
8. What is a Prisma transaction?
9. Why must related checkout writes be in one transaction?
10. What happens when an error is thrown inside an interactive transaction?
11. Why do we use the `tx` client inside a transaction?
12. Why does a transaction not automatically prevent every inventory race?
13. What is the difference between `prisma migrate dev` and `prisma db push`?

## 16. Day 3 Status

- [x] Prisma schema validation and client generation
- [x] Prisma PostgreSQL adapter setup
- [x] Create, read, update, and delete
- [x] `findUnique()`, `findFirst()`, and `findMany()`
- [x] Filtering, sorting, selecting, and limiting
- [x] `include` vs `select`
- [x] Nested relation queries
- [x] Missing-record handling
- [x] Prisma transaction for order, item, and stock
- [x] Rollback experiment
- [x] Migration command differences reviewed
- [x] Actual schema migration exercise — skipped because the workflow was already understood
