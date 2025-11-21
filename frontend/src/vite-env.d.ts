/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_URL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

// Type declaration for plotly.js-dist-min
declare module "plotly.js-dist-min" {
	import Plotly from "plotly.js";
	export default Plotly;
}
