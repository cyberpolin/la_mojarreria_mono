const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const PRODUCT_SEEDS = [
  {
    name: "Mojarra Frita",
    price: 150,
    rawCost: 90,
    description: "Mojarra frita completa.",
    images: [
      {
        publicId: "seed/mojarra-frita/cover",
        secureUrl:
          "https://res.cloudinary.com/demo/image/upload/v1/samples/food/fish-vegetables.jpg",
      },
    ],
  },
  {
    name: "Empanada de Camaron",
    price: 100,
    rawCost: 55,
    description: "Empanada rellena de camaron.",
    images: [
      {
        publicId: "seed/empanada-camaron/cover",
        secureUrl:
          "https://res.cloudinary.com/demo/image/upload/v1/samples/food/spices.jpg",
      },
    ],
  },
  {
    name: "Empanada de Minilla",
    price: 100,
    rawCost: 50,
    description: "Empanada rellena de minilla.",
    images: [
      {
        publicId: "seed/empanada-minilla/cover",
        secureUrl:
          "https://res.cloudinary.com/demo/image/upload/v1/samples/food/dessert.jpg",
      },
    ],
  },
];

async function main() {
  for (const seed of PRODUCT_SEEDS) {
    const existing = await prisma.product.findFirst({
      where: { name: seed.name },
      select: { id: true },
    });

    if (existing?.id) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          price: seed.price,
          rawCost: seed.rawCost,
          description: seed.description,
          timeProcess: "30",
          images: seed.images,
          active: true,
        },
      });
      continue;
    }

    await prisma.product.create({
      data: {
        name: seed.name,
        price: seed.price,
        rawCost: seed.rawCost,
        description: seed.description,
        timeProcess: "30",
        images: seed.images,
        active: true,
      },
    });
  }

  console.log(`Product seed completed (${PRODUCT_SEEDS.length} products).`);
}

main()
  .catch((error) => {
    console.error("Product seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
