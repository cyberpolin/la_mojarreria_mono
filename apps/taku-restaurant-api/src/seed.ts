import { config } from "./config.js";
import { hashPassword } from "./auth.js";
import { id, now, JsonStore } from "./store.js";
import type { Restaurant, User } from "./types.js";

export async function seedOwner(store: JsonStore) {
  await store.update((database) => {
    if (database.users.some((item) => item.email === config.ownerEmail)) {
      return;
    }
    const restaurant: Restaurant = {
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
    database.restaurants.push(restaurant);
    database.users.push(user);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const store = new JsonStore(config.dataFile);
  void seedOwner(store).then(() => {
    console.log("taku-restaurant-api seed complete");
  });
}
