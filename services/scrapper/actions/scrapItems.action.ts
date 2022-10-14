import { ActionSchema, Service } from "moleculer";
import fs from 'fs';
import axios from 'axios';

const action: ActionSchema<any> = {
    async handler()  {
        const service = this as Service;
        const logger = service.logger;

        /** fetch html from website
         * then store it in a file
         */
        const site = `https://www.carsensor.net`;
        let page = service.metadata.page;
        
        for (var i = 0; i < 10; i++) {
            await fetchPage();
            page++;
        }
       

        async function fetchPage() {
            const url = `${site}/usedcar/index${page}.html`;
            logger.debug(`Fetching ${url}`);
            const response = await axios.get(url);
            const htmlText = await response.data;
            /** Store Html to tmp folder
             * make sure to create the tmp folder
             */
            const folder = `./tmp/carsensor`;
            const filePath = `${folder}/${page}.html`;
            fs.mkdirSync(folder, { recursive: true });
            fs.writeFileSync(filePath, htmlText);
            logger.debug(`Stored ${filePath}`);
        }
    }
}

export default action;