"use strict";

import { Service, ServiceBroker, Context } from "moleculer";
import { setupBrowser } from './libs/browser';
import actions from './actions';

export default class ScrapperService extends Service {

	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name:"scrapper",

			/**
			 * Service settings
			 */
			settings: {
				debug: true,
			},

			/**
			 * Service metadata
			 */
			metadata: {
				/** Chrome browser instance */
				browser: null,
				/** Current Items Page Number */
				page: 1,

			},

			/**
			 * Service dependencies
			 */
			dependencies: [],

			/**
			 * Actions
			 */

			actions:{
				...actions,
			},

			methods: {
				goToPage: async (pageNumber: number) => {
					/** Config */
					const site = `https://www.carsensor.net`;
					const url = `${site}/usedcar/index${pageNumber}.html`;
					
					const browser = this.metadata.browser;
					const page = await browser.newPage();

					/** Navigate to the page */
					this.logger.debug(`Navigating to ${url}`);
					await page.goto(url, { waitUntil: 'networkidle2' });
				}
			},

			started: async () => {
				this.logger.debug("Scrapper service started======");
				/** Start browser */
				let browser = this.metadata.browser;
				if (browser === null) {
					// browser = await setupBrowser({
					// 	headless: this.settings.debug ? false : true,
					// })
				}

				this.metadata.browser = browser;
			},
			stopped: async () => {
				/** Stop browser */
				const browser = this.metadata.browser;
				if (browser !== null) {
					await browser.close();
				}
			}
		});

	}

}
