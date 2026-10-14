import { prisma } from './prisma-client';

async function main() {
  // All database writes commit together or roll back if any operation fails.
  await prisma.$transaction(async (tx) => {
    const product = await tx.products.findUnique({
      where: { id: 1 },
    });

    // Validate stock before creating the order.
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
        order_id: order.id, // Use the ID generated for this order.
        product_id: product.id,
        quantity: 1,
        price_paise: product.price_paise, // Store the purchase-time price.
      },
    });

    await tx.products.update({
      where: {
        id: product.id,
      },
      data: {
        stock_quantity: {
          decrement: 1,
        },
      },
    });

    // Uncomment to test rollback: the order, item, and stock change should all be undone.
    // throw new Error('Testing rollback');
  });

  console.log('Order created successfully');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
