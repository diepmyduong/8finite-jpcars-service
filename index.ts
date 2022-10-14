const { ServiceBroker } = require("moleculer");
const config = require("./moleculer.config");

config.hotReload = true;

const broker = new ServiceBroker(config);

broker.loadServices("dist/services", "**/*.service.js");
broker.start();
