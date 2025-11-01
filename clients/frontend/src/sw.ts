// src/sw.ts
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
	addEventListener: (
		type: string,
		listener: (event: MessageEvent) => void,
	) => void;
	skipWaiting: () => void;
};

self.addEventListener("message", (event: MessageEvent) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});

precacheAndRoute(self.__WB_MANIFEST);
