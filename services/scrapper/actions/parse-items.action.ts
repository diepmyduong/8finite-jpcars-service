import axios from "axios";
import { Cheerio, CheerioAPI, load } from "cheerio";
import fs from "fs";
import _ from "lodash";
import { ActionSchema, Service } from "moleculer";
import sleep from "atomic-sleep";

const action: ActionSchema = {
	async handler() {
		const service = this as Service;
		const logger = service.logger;

		/** Load html file from tmp folder */
		const folder = `./tmp/carsensor`;
		const files = fs.readdirSync(folder);

		for (const file of files) {
			const filePath = `${folder}/${file}`;
			const htmlText = fs.readFileSync(filePath, "utf8");
			const pageNumber = /(\d+)\.html/.exec(file)[1];
			logger.debug(`Loaded ${filePath}`);

			/** Parse html file */
			const $ = load(htmlText);
			const productDivs = $("#carList .js_listTableCassette");
			logger.debug(`Found ${productDivs.length} products`);

			const products: any[] = [];

			for (const div of productDivs) {
				try {
					const $div = $(div);
					const detail_url = "https://www.carsensor.net" + $div.find(".cassetteMain__title a").attr("href");
					const specifications = $div
						.find(".casetMedia__body__spec p")
						.map(function () {
							return $(this)
								.text()
								.replace(/^\s+|\s+$/g, "")
								.replace(/\s\s+/g, " ");
						})
						.toArray();

					const item: any = {
						item_id: $div.find(".btnFunc--favoriteLarge").attr("id").replace("_btn", ""),
						url: detail_url,
						picture: [],
						title: $div.find(".cassetteMain__title  a").text(),
						specification: specifications,
						price:
							$div.find(".basePrice .basePrice__mainPriceNum").text() +
							$div.find(".basePrice .basePrice__subPriceNum").text(),
						price_unit: $div.find(".basePrice .basePrice__unit").text(),
						offer_price: $div.find(".totalPrice .totalPrice__mainPriceNum").text(),
						offer_price_unit: $div.find(".totalPrice .totalPrice__unit").text(),
						plan_a: $div.find(".planPrice .planPrice__priceNum span").eq(0).text(),
						plan_b: $div.find(".planPrice .planPrice__priceNum span").eq(1).text(),
					};

					products.push(item);
				} catch (err) {
					logger.error("Error parsing product", err);
				}
			}

			logger.debug(`Parsed ${products.length} products`);
			console.dir(products[0]);
			// console.table(
			// 	_.map(products, (i) => _.omit(i, ["url", "mainImg"]))
			// );

			/** Fetch product detail HTML to tmp folder */
			const detailFolder = `./tmp/carsensor/detail`;
			if (!fs.existsSync(detailFolder)) {
				fs.mkdirSync(detailFolder);
			}
			/** Get product detail */
			for (const product of products) {
				const filePath = detailFolder + "/" + product.item_id + ".html";
				try {
					if (!fs.existsSync(filePath)) {
						/** random sleep time from 0 to 3 second */
						const sleepTime = Math.floor(Math.random() * 3000);
						logger.debug(`Sleeping for ${sleepTime} ms`);
						await sleep(sleepTime);
						/** Fetch product detail page */
						/** remove query from url */
						const url = product.url.split("?")[0];
						const response = await axios({
							url: url,
							method: "GET",
							headers: {
								/** Add Google robot agent header */
								"User-Agent": "Googlebot",
								Host: "www.carsensor.net",
							},
						}).catch((err) => {
							logger.error(`fetch product error:: ` + product.item_id, err.message);
							return null;
						});
						if (!response) continue;
						const html = response.data;
						/** Store  */

						fs.writeFileSync(filePath, html);
						logger.debug(`Saved ${filePath}`);
					}
					logger.debug(`File ${filePath} already exists`);
					const html = fs.readFileSync(filePath, "utf8");
					/** Parse product detail */
					const $ = load(html);
					try {
						/** Get picture */
						extractProductDetail(product, $);
						product.page_no = pageNumber;
						console.dir(product);
						return;
					} catch (e) {
						logger.error(`parse product error:::` + product.item_id, e);
					}
				} catch (err) {
					logger.error("Error fetching product detail", err);
				}
			}

			return;
		}
	},
};

function extractProductDetail(product: any, $: CheerioAPI) {
	product.picture = $(".subSliderMain__inner__set a")
		.map((_, a) => $(a).attr("data-photo"))
		.toArray()
		.map((url) => {
			if (url.startsWith("//")) {
				return "https:" + url;
			}
			if (url.startsWith("/")) {
				return "https://www.carsensor.net" + url;
			}
			return url;
		});
	product.doors = ($('th:contains("ドア数")').next().text() || "").trim();
	product.seat_capacity = ($('th:contains("乗車定員")').next().text() || "").trim();
	product.fuel = ($('th:contains("使用燃料")').next().text() || "").trim();
	product.color = ($('th:contains("色")').next().text() || "").trim();
	product.wheel_drive = ($('th:contains("駆動方式")').next().text() || "").trim();
	product.body_type = ($('th:contains("ボディタイプ")').next().text() || "").trim();
	product.engine_cc = ($('th:contains("排気量")').next().first().text() || "").toString().replace("cc", "");
	product.engine_type = ($('th:contains("エンジン種別")').next().text() || "").trim();
	product.model_year = $('.specWrap__box__title:contains("年式")').next().text();
	product.repair_history = ($('th:contains("修復歴")').next().text() || "").trim();
	product.mileage = (($('th:contains("走行距離")').next().text() || "").match(/\d+/g) || [])?.join("");
	product.basic_spec_new_car = $('h2:contains("新車時の基本スペック")')
		.children()
		.text()
		.toString()
		.replace("(", "")
		.replace(")", "");

	const productSize = ($('th:contains("車体寸法")').next().text() || "").trim();
	if (productSize) {
		try {
			product.length = (productSize.split("×")[0] || "").trim().match(/\d+/g)[0];
			product.width = (productSize.split("×")[1] || "").trim().match(/\d+/g)[0];
			product.height = (productSize.split("×")[2] || "").trim().match(/\d+/g)[0];
			product.size_unit = productSize
				.split("×")[2]
				?.match(/\((\D+)\)/g)[0]
				.replace("(", "")
				.replace(")", "");
		} catch (err) {
			console.error("Error parsing product size", err, product);
			console.log("productSize", productSize);
		}
	}

	product.make = ($('link[href*="catalog"]:nth(0)').attr("href") || "").split("/")[4];
	product.model = ($('link[href*="catalog"]:nth(1)').attr("href") || "").split("/")[5];
	product.chassis_no = ($('th:contains("車台末尾番号")').next().text() || "").trim();
	product.steering = ($('th:contains("ハンドル")').next().text() || "").trim();
	product.condition = "";
	product.mfg_year = product.model_year;

	product.mission = ($('th:contains("ミッション")').next().text() || "").trim();
	product.moving_way = ($('th:contains("駆動方式")').next().text() || "").trim();
	product.wheelbase = ($('th:contains("ホイールベース")').next().text() || "").trim();
	product.vehicle_weight = ($('th:contains("車両重量")').next().text() || "").trim();
	product.indoor = ($('th:contains("室内")').next().text() || "").trim();
	const JC08_fuel_economy = ($('th:contains("JC08燃費")').next().text() || "").trim();
	/** 19.8（km/L）' */
	product.JC08_fuel_economy = Number((JC08_fuel_economy.split("（")[0] || "").trim());
	product.JC08_fuel_economy_unit = (JC08_fuel_economy.split("（")[1] || "").slice(0, -1);
	product.WLTC_fuel_economy = ($('th:contains("WLTC燃費")').next().text() || "").trim();
	product.minimum_turning_radius = ($('th:contains("最小回転半径")').next().text() || "").trim();
	product.number_of_sheet_rows = ($('th:contains("シート列数")').next().text() || "").trim();
	product.location = ($('.specWrap__box__title:contains("地域")').next().text() || "").trim();
	product.reg_year = product.model_year;
	if (product.model_year == "" || isNaN(product.model_year)) {
		delete product.model_year;
		delete product.reg_year;
	}
	product.inspection_year = ($('p:contains("車検有無")').next().text() || "").trim().slice(0, 4);
	product.inspection_month = (($('p:contains("車検有無")').next().next().text() || "").trim().match(/\d+/g) || [])[0];
	product.reg_month = product.inspection_month;
	if (product.inspection_month == "" || isNaN(product.inspection_month)) {
		delete product.inspection_month;
		delete product.reg_month;
	}
	if (product.inspection_year == "" || isNaN(product.inspection_year)) {
		delete product.inspection_year;
	}
	product.price = Number(product.price) * 10000;
	product.price_unit = product.price_unit.replace("万", "");
	product.offer_price = Number(product.offer_price) * 10000;
	product.offer_price_unit = product.offer_price_unit.replace("万", "");
	product.sale_price = product.offer_price;
	product.sale_price_unit = product.offer_price_unit;
}

export default action;
