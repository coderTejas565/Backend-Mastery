# Day 1 — SQL Foundations

## 1. Goal

Understand relational database design and write SQL queries for backend data retrieval.

## 2. Database Schema

- users → orders: one-to-many
- orders → order_items: one-to-many
- products → order_items: one-to-many
- order_items stores purchase price as a snapshot.

## 3. Constraints

- PRIMARY KEY: uniquely identifies a row.
- FOREIGN KEY: maintains relationships between tables.
- NOT NULL: prevents missing values.
- UNIQUE: prevents duplicate values.
- CHECK: restricts values based on a condition.

## 4. Important SQL Concepts

### JOIN

Combines related rows from multiple tables.

```sql
SELECT users.name, orders.id AS order_id
FROM users
JOIN orders ON users.id = orders.user_id;
```

### LEFT JOIN

Returns every row from the left table, including rows without a match. Missing right-side values become NULL.

### GROUP BY

Groups rows so aggregate functions can calculate a result per group.

### Aggregate Functions

- COUNT(): counts rows or non-NULL values.
- SUM(): adds numeric values.
- COALESCE(value, 0): replaces NULL with 0.

### WHERE vs HAVING

- WHERE filters rows before grouping.
- HAVING filters groups after aggregation.

### DISTINCT

Removes duplicate values from query results.

### ORDER BY

- ASC: ascending order.
- DESC: descending order.

## 5. Important Query

### Customer Order Summary

```sql
SELECT
    users.name AS customer_name,
    COUNT(DISTINCT orders.id) AS total_orders,
    COALESCE(
        SUM(order_items.quantity * order_items.price_paise),
        0
    ) AS total_amount
FROM users
LEFT JOIN orders
    ON users.id = orders.user_id
LEFT JOIN order_items
    ON orders.id = order_items.order_id
GROUP BY
    users.id,
    users.name
ORDER BY total_amount DESC;
```

## 6. Mistakes I Made

- Tried to use HAVING inside SELECT.
- Forgot that GROUP BY is required with non-aggregated selected columns.
- Initially counted the wrong column.
- Learned that COUNT(DISTINCT orders.id) avoids counting an order multiple times after joining order_items.

## 7. Backend Connection

These queries are similar to API endpoints that return customer order summaries, dashboards, and reports.

## 8. Practice Questions

1. Find users with no orders.
2. Find users with at least two orders.
3. Calculate each order's total.
4. Find the highest-value order.
5. Explain why COUNT(DISTINCT orders.id) is used.

## 9. Day 1 Status

- [x] Schema design
- [x] Seed data
- [x] JOINs
- [x] LEFT JOIN
- [x] GROUP BY
- [x] HAVING
- [x] COUNT and SUM
- [x] COALESCE
- [x] DISTINCT
- [x] Customer order summary
