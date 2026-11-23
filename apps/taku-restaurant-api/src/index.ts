import { config } from "./config.js";
import { createApp } from "./app.js";
import { JsonStore } from "./store.js";
import { seedOwner } from "./seed.js";

const store = new JsonStore(config.dataFile);
const app = createApp(store);

void seedOwner(store).then(() => {
  app.listen(config.port, config.host, () => {
    console.log(
      `taku-restaurant-api on http://${config.host}:${config.port}/api`,
    );
  });
});
