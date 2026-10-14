import { Prisma } from './generated/prisma/client';
import { prisma } from './prisma-client';

async function main() {
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

  const orders = await prisma.orders.findMany({
    where: {
      user_id: 2,
    },
    orderBy: {
      id: 'desc',
    },
    take: 5,
  });

  const UniqueP = await prisma.products.findUnique({
    where: {
      id: 1,
    },
    select: {
      name: true,
      price_paise: true,
      stock_quantity: true,
    },
  });

  //   const newUser = await prisma.users.create({
  //     data: {
  //       name: 'CRUD Test',
  //       email: 'crud-test@example.com',
  //     },
  //   });

  //   const updatedUser = await prisma.users.update({
  //     where: {
  //       id: 10007,
  //     },
  //     data: {
  //       name: 'CRUD Test Updated',
  //     },
  //   });

  //   const deletedUser = await prisma.users.delete({
  //     where: {
  //       id: 10007,
  //     },
  //   });

  //   const usersWithOrders = await prisma.users.findUnique({
  //     where: {
  //       id: 1,
  //     },
  //     include: {
  //       orders: true,
  //     },
  //   });

  //   const userOrderHistory = await prisma.users.findUnique({
  //     where: {
  //       id: 999999,
  //     },
  //     select: {
  //       id: true,
  //       name: true,
  //       orders: {
  //         orderBy: {
  //           id: 'desc',
  //         },
  //         take: 5,
  //         select: {
  //           id: true,
  //           status: true,
  //           created_at: true,
  //           order_items: {
  //             select: {
  //               quantity: true,
  //               price_paise: true,
  //               products: {
  //                 select: {
  //                   id: true,
  //                   name: true,
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       },
  //     },
  //   });

  //   if (!userOrderHistory) {
  //     console.log('User not found');
  //   } else {
  //     console.log(userOrderHistory);
  //     }

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

  //   console.log(newUser);
  //   console.log(updatedUser);
  //   console.log('Deleted user:', deletedUser);
  //   console.dir(usersWithOrders, { depth: null });
  // console.dir(userOrderHistory, { depth: null });
  console.log(firstThree);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
