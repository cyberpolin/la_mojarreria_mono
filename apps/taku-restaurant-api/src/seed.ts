import { config } from "./config.js";
import { DEFAULT_PRODUCTS } from "./catalog.js";
import { hashPassword } from "./auth.js";
import { id, now, JsonStore } from "./store.js";
import type { Product, User } from "./types.js";

function seedDefaultProducts(
  restaurantId: string,
  products: Product[],
): Product[] {
  const timestamp = now();
  for (const item of DEFAULT_PRODUCTS) {
    if (
      products.some(
        (row) =>
          row.restaurantId === restaurantId && row.clientId === item.clientId,
      )
    ) {
      continue;
    }
    products.push({
      id: id("product"),
      restaurantId,
      clientId: item.clientId,
      name: item.name,
      priceCents: item.priceCents,
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  return products;
}

export async function seedOwner(store: JsonStore) {
  await store.update((database) => {
    let restaurant = database.restaurants.find(
      (item) => item.slug === "la-mojarreria",
    );
    if (!database.users.some((item) => item.email === config.ownerEmail)) {
      restaurant = restaurant ?? {
        id: id("restaurant"),
        name: config.ownerName,
        slug: "la-mojarreria",
        plan: "business",
        timezone: "America/Mexico_City",
        createdAt: now(),
        updatedAt: now(),
      };
      const user: User = {
        id: id("user"),
        restaurantId: restaurant.id,
        name: config.ownerName,
        email: config.ownerEmail,
        passwordHash: hashPassword(config.ownerPassword),
        role: "owner",
        status: "active",
        createdAt: now(),
        updatedAt: now(),
      };
      if (!database.restaurants.some((item) => item.id === restaurant!.id)) {
        database.restaurants.push(restaurant);
      }
      database.users.push(user);
    }
    const restaurantId =
      restaurant?.id ??
      database.users.find((item) => item.email === config.ownerEmail)
        ?.restaurantId;
    if (restaurantId) {
      seedDefaultProducts(restaurantId, database.products);
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const store = new JsonStore(config.dataFile);
  void seedOwner(store).then(() => {
    console.log("taku-restaurant-api seed complete");
  });
}
