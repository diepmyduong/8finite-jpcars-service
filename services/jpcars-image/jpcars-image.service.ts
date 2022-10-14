"use strict";
import sleep from "atomic-sleep";
import AWS from "aws-sdk";
import config from "config";
import { Service, ServiceBroker } from "moleculer";
import { Model, Schema } from "mongoose";
import fetch from "node-fetch";

import { Mongo } from "../../libs/mongo";

export default class JpcarsImageService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "jpcars-image",

			/**
			 * Service settings
			 */
			settings: {},

			/**
			 * Service metadata
			 */
			metadata: {},

			/**
			 * Service dependencies
			 */
			dependencies: [],

			/**
			 * Actions
			 */

			actions: {},

			methods: {
				start: async () => {
					this.logger.info("Starting Upload JPCars Images:::::");
					/** fetch items has image not upload yet */
					const model: Model<{ picture: string[] }> = this.metadata.$model;
					const cursor = model
						.find({ picture: /^(?!https:\/\/jpcars-img).*/ })
						.sort({ updated_at: 1 })
						.select("_id picture")
						.limit(30)
						.cursor();

					for await (const item of cursor) {
						this.logger.info(`Processing ${item.id}::: picture::: ${item.picture.length}`);
						const uploadedImages = await Promise.all(
							item.picture.map(async (picture: string) => {
								try {
									const filePath = new URL(picture).pathname.substring(1);
									const result = await this.uploadImageFromUrl(picture, filePath);
									console.log("Uploaded picture to S3:::" + result.Location);
									return result.Location;
								} catch (err) {
									console.error("Error uploading picture to S3", err.message);
									return picture;
								}
							})
						);
						await model.updateOne({ _id: item._id }, { $set: { picture: uploadedImages } });

						/** Delay random from 1 to 5 seconds */
						const sleepTime = Math.floor(Math.random() * 5 + 1) * 1000;
						this.logger.info(`Sleeping for ${sleepTime}ms`);
						await sleep(sleepTime);
					}
				},
				/** Fetch image from url
				 * then upload to aws s3
				 */
				uploadImageFromUrl: async (url: string, filePath: string) => {
					const res = await fetch(url);
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
					return result;
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
					/** Complete and delay 1 minute to restart again */
					this.logger.info("Complete, delay 1 minute to restart again");
					await sleep(60000);
				}
			},
		});
	}
}
