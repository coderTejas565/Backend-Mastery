import { prisma } from './prisma-client';

async function main() {
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
      where: {
        id: product.id,
      },
      data: {
        stock_quantity: {
          decrement: 1,
        },
      },
    });
  });
  // throw new Error("Testing rollback");

  console.log('Order created sucessfully');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
