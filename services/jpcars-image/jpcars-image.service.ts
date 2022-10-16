"use strict";
import sleep from "atomic-sleep";
import AWS from "aws-sdk";
import config from "config";
import { Service, ServiceBroker } from "moleculer";
import { Model, Schema } from "mongoose";
import fetch from "node-fetch";
import moment from "moment-timezone";

import { Mongo } from "../../libs/mongo";
import _ from "lodash";

export default class JpcarsImageService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "jpcars-image",
			methods: {
				start: async () => {
					this.logger.info("Starting Upload JPCars Images:::::");
					/** fetch items has image not upload yet */
					const model: Model<{ picture: string[]; picture_updated_at: string }> = this.metadata.$model;
					const picture_updated_at = moment().format("YYYY-MM-DD");
					const cursor = model
						.find({
							picture: /^(?!https:\/\/jpcars-img).*/,
							status: "Available",
						})
						.sort({ updated_at: -1 })
						.select("_id picture")
						.limit(30)
						.cursor();

					for await (const item of cursor) {
						this.logger.info(`Processing ${item.id}::: picture::: ${item.picture.length}`);

						// Chunk image to max 20 images per request
						const chunkSize = config.get<number>("jpcarsImage.uploadPool");
						const chunk = _.chunk(item.picture, chunkSize);
						let uploadImages: string[] = [];
						for (const images of chunk) {
							const uploaded = await Promise.all(
								images.map(async (picture: string) => {
									try {
										const filePath = new URL(picture).pathname.substring(1);
										const result = await this.uploadImageFromUrl(picture, filePath);

										return result;
									} catch (err) {
										console.error("Error uploading picture to S3", err.message);
										return picture;
									}
								})
							);
							uploadImages = uploadImages.concat(uploaded);
						}

						const setData: any = { picture: uploadImages };

						if (!item.picture[0].includes("jpcars-img")) {
							setData.status = "OLD-DATA";
						}

						this.logger.info("Updating item data::::", item._id);
						await model.updateOne({ _id: item._id }, { $set: setData });
						this.logger.info("Updated item data::::", item._id);
						/** Delay random from 1 to 5 seconds */
						// const sleepTime = Math.floor(Math.random() * 5 + 1) * 1000;
						// this.logger.info(`Sleeping for ${sleepTime}ms`);
						// await sleep(sleepTime);
					}
					cursor.close();
				},
				/** Fetch image from url
				 * then upload to aws s3
				 */
				uploadImageFromUrl: async (url: string, filePath: string) => {
					/** Set timeout to 30 second */
					const res = await fetch(url, { timeout: 30000 });
					/** if request has error
					 * then return original url
					 */
					if (!res.ok) {
						this.logger.error("Error fetching image from url", url);
						return url;
					}
					/** if response is not image
					 * then return original url
					 */
					if (!res.headers.get("content-type")?.startsWith("image")) {
						this.logger.error("Response is not image", url);
						return url;
					}

					const buffer = await res.buffer();
					// /** download to tmp folder */
					// const fileName = filePath.split("/").pop();
					// const tmpFilePath = `/tmp/img/${fileName}`;
					// fs.mkdirSync("/tmp/img", { recursive: true });
					// fs.writeFileSync(tmpFilePath, await res.buffer());

					const s3: AWS.S3 = this.metadata.$s3;

					const params = {
						Bucket: config.get<string>("aws.bucket"),
						Key: filePath,
						Body: buffer,
					};

					const result = await s3.upload(params).promise();
					this.logger.info("Uploaded image to S3", result.Location);
					return result.Location;
				},
				/** Init S3 Instance */
				initS3: async () => {
					const s3 = new AWS.S3({
						region: config.get<string>("aws.region"),
						apiVersion: config.get<string>("aws.apiVersion"),
						accessKeyId: config.get<string>("aws.accessKeyId"),
						secretAccessKey: config.get<string>("aws.secretAccessKey"),
					});
					this.metadata.$s3 = s3;
				},
				/** Init Mongo Connection */
				initMongo: async () => {
					const db = await Mongo();
					const schema = new Schema(
						{
							picture: { type: [String], required: true, default: [] },
							picture_updated_at: { type: String },
							status: { type: String },
						},
						{ collection: "items" }
					);
					schema.index({ updated_at: 1 });
					const model = db.model("items", schema);
					this.metadata.$model = model;
				},
			},
			started: async () => {
				/** Init S3 Instance */
				await this.initS3();

				/** Init Mongo Model */
				await this.initMongo();

				/** Start process */
				while (true) {
					await this.start();
					/** Complete and delay 10 seconds to restart again */
					this.logger.info("Complete, delay 10 second to restart again");
					await sleep(10000);
				}
			},
		});
	}
}
