-- Generate test users.
INSERT INTO users (name, email)
SELECT
    'Load User ' || generate_series,
    'loaduser' || generate_series || '@example.com'
FROM generate_series(1, 10000);

SELECT COUNT(*)
FROM users;


-- Generate 10 orders for every user.
INSERT INTO orders (user_id, status)
SELECT
    id,
    'completed'
FROM users
CROSS JOIN generate_series(1, 10);

SELECT COUNT(*)
FROM orders;


-- Check the execution plan with the index.
EXPLAIN ANALYZE
SELECT *
FROM orders
WHERE user_id = 1;


-- Remove the index to compare performance.
DROP INDEX idx_orders_user_id;

EXPLAIN ANALYZE
SELECT *
FROM orders
WHERE user_id = 1;


-- Recreate the index.
CREATE INDEX idx_orders_user_id
ON orders(user_id);

-- Verify that PostgreSQL uses the index again.
EXPLAIN ANALYZE
SELECT *
FROM orders
WHERE user_id = 1;