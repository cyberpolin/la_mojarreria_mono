import { createServer } from "node:http";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { createRealtimeServer } from "./realtime.js";
import { JsonStore } from "./store/jsonStore.js";

const store = new JsonStore(config.dataFile);
const server = createServer();
const realtime = createRealtimeServer(server, store);
const app = createApp(store, realtime);

server.on("request", app);

server.listen(config.port, config.host, () => {
  console.log(
    `taku-backend listening on http://${config.host}:${config.port}/api`,
  );
});
