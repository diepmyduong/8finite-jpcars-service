import { Schema } from "mongoose";
import { Mongo } from "../mongo";

const itemSchema = new Schema({
	picture: { type: [String], default: [] },
	JC08_fuel_economy: { type: String },
	JC08_fuel_economy_unit: { type: String },
	updated_at: { type: Date },
});
itemSchema.index({ updated_at: 1 });
itemSchema.index({ JC08_fuel_economy: 1 });

async function itemModel() {
	const db = await Mongo();
	return db.model("items", itemSchema);
}

export { itemModel };
