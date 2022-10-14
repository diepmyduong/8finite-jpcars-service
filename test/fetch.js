const fetch = require("node-fetch");
const HttpsProxyAgent = require("https-proxy-agent");

(async () => {
	const proxyAgent = new HttpsProxyAgent("http://localhost:3128");
	fetch("https://ipinfo.io/ip", {
		agent: proxyAgent,
	})
		.then((res) => res.text())
		.then(console.log);
})();
