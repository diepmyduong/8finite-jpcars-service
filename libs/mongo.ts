import mongoose, { Connection } from "mongoose";
import config from "config";
const mongoUri = config.get<string>("mongo.uri");

let _connection: Connection;

async function Mongo() {
	if (_connection) return _connection;
	_connection = mongoose.createConnection(mongoUri);

	_connection.asPromise().catch((err) => {
		console.error(`MonogDB connection error: ${err.message}`);
		process.exit(1);
	});

	_connection.on("error", (err) => {
		console.error(`MonogDB connection error: ${err.message}`);
		process.exit(1);
	});

	_connection.on("open", () => {
		console.log(`MongoDB connected`);
	});

	_connection.on("disconnected", () => {
		console.log(`MongoDB disconnected`);
	});

	return _connection;
}

export { Mongo };

// mongoose.set("debug", (collectionName: string, method: string, query: any) => {
//   logger.info("mongo", { collectionName, method, query });
// });
