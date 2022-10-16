const dotenv = require("dotenv");

dotenv.config();

module.exports = {
	timezone: "Asia/Ho_Chi_Minh",
	mongo: {
		/** Connection String Mongo */
		uri: null,
	},
	/** AWS S3 Config */
	aws: {
		region: "ap-southeast-1",
		accessKeyId: null,
		secretAccessKey: null,
		bucket: null,
		apiVersion: "2006-03-01",
	},

	/** JPCars Image Service */
	jpcarsImage: {
		/** Limit concurency image upload per request */
		uploadPool: 20,
		/** Ignore fetch image hosts */
		ignoreHosts: ["jpcars-img.s3-ap-southeast-1.amazonaws.com", "www.carsensor.net"],
	},
};
