import { prisma } from './prisma-client';

async function main() {
  // Select only required fields to avoid fetching unnecessary user data.
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

  // findMany returns an array; an empty array is valid if no orders match.
  const orders = await prisma.orders.findMany({
    where: {
      user_id: 2,
    },
    orderBy: {
      id: 'desc',
    },
    take: 5,
  });

  // findUnique requires a unique field and returns null if no record exists.
  const uniqueProduct = await prisma.products.findUnique({
    where: {
      id: 1,
    },
    select: {
      name: true,
      price_paise: true,
      stock_quantity: true,
    },
  });

  // CREATE: email must be unique; creating a duplicate throws an error.
  // const newUser = await prisma.users.create({
  //   data: {
  //     name: 'CRUD Test',
  //     email: 'crud-test@example.com',
  //   },
  // });

  // UPDATE: update requires a unique record and throws if it doesn't exist.
  // const updatedUser = await prisma.users.update({
  //   where: {
  //     id: 10007,
  //   },
  //   data: {
  //     name: 'CRUD Test Updated',
  //   },
  // });

  // DELETE: delete removes one matching record and throws if it doesn't exist.
  // const deletedUser = await prisma.users.delete({
  //   where: {
  //     id: 10007,
  //   },
  // });

  // include returns all user fields plus the requested related orders.
  // const usersWithOrders = await prisma.users.findUnique({
  //   where: {
  //     id: 1,
  //   },
  //   include: {
  //     orders: true,
  //   },
  // });

  // Nested select controls which fields are returned at every relation level.
  // findUnique can return null, so check the result before accessing its fields.
  // const userOrderHistory = await prisma.users.findUnique({
  //   where: {
  //     id: 999999,
  //   },
  //   select: {
  //     id: true,
  //     name: true,
  //     orders: {
  //       orderBy: {
  //         id: 'desc',
  //       },
  //       take: 5,
  //       select: {
  //         id: true,
  //         status: true,
  //         created_at: true,
  //         order_items: {
  //           select: {
  //             quantity: true,
  //             price_paise: true,
  //             products: {
  //               select: {
  //                 id: true,
  //                 name: true,
  //               },
  //             },
  //           },
  //         },
  //       },
  //     },
  //   },
  // });

  // if (!userOrderHistory) {
  //   console.log('User not found');
  // } else {
  //   console.log(userOrderHistory);
  // }

  // Filter, sort, limit, and select: a common pattern for list endpoints.
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

  // console.log(newUser);
  // console.log(updatedUser);
  // console.log('Deleted user:', deletedUser);
  // console.dir(usersWithOrders, { depth: null });
  // console.dir(userOrderHistory, { depth: null });

  console.log(firstThree);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
