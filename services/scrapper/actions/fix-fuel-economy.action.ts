import { ActionSchema, Service } from "moleculer";
import { Types } from "mongoose";
import { itemModel } from "../../../libs/models/jpcars.model";
import { Mongo } from "../../../libs/mongo";

const action: ActionSchema = {
	async handler() {
		const service = this as Service;
		const logger = service.logger;

		logger.info("Fixing fuel economy");

		/** Init model */
		const model = await itemModel();

		/** Find incorrect items */
		const cursor = model
			.find({ JC08_fuel_economy: /（/ })
			.select("_id JC08_fuel_economy")
			.lean()
			.sort({ updated_at: -1 })
			.cursor();

		const batchSize = 1000;
		let items: any[] = [];

		const updateItems = async () => {
			logger.info(`Updating ${items.length} items`);
			let bulkWrite = model.collection.initializeOrderedBulkOp();
			for (const item of items) {
				const { _id, JC08_fuel_economy } = item;
				const setData = {
					JC08_fuel_economy: Number((JC08_fuel_economy.split("（")[0] || "").trim()),
					JC08_fuel_economy_unit: (JC08_fuel_economy.split("（")[1] || "").slice(0, -1),
				};
				bulkWrite.find({ _id: new Types.ObjectId(_id) }).updateOne({ $set: setData });
			}
			if (bulkWrite.batches.length > 0) {
				await bulkWrite.execute();
			}
			items = [];
		};
		/** Fix incorrect items */
		for await (const item of cursor) {
			items.push(item);
			if (items.length == batchSize) {
				await updateItems();
			}
		}
		if (items.length > 0) {
			await updateItems();
		}

		cursor.close();

		logger.info("Completed fixing fuel economy");
	},
};

export default action;
