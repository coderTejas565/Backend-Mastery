import { prisma } from "./prisma-client";

async function holdConnection(id: number) {
  console.log(`Request ${id} started`);

  try {
    // Hold a database connection for 5 seconds.
    // This simulates a long-running PostgreSQL query.
    await prisma.$queryRaw`
      SELECT pg_sleep(5)::text AS sleep_result
    `;

    console.log(`Request ${id} finished`);
  } catch (error) {
    // The pool is exhausted when all connections are busy.
    // Waiting for a free connection beyond the timeout causes this failure.
    console.log(`Request ${id} failed: connection timeout`);
  }
}

await Promise.all(
  Array.from({ length: 5 }, (_, i) => holdConnection(i + 1))
);

await prisma.$disconnect();