import { createContext, useContext, useEffect, useState } from "react";
import { Branding, DEFAULT_BRANDING } from "@/lib/config/branding";
import { getPublicConfig } from "@/lib/services/configService";

const BrandingContext = createContext<Branding>(DEFAULT_BRANDING);

/**
 * Provides white-label branding (name, links, contact) to the app.
 * Starts from the baked-in defaults and overlays the runtime config fetched
 * from GET /api/config/public; keeps defaults if the endpoint is unavailable.
 */
export default function BrandingProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);

	useEffect(() => {
		let cancelled = false;
		getPublicConfig()
			.then((data) => {
				if (!cancelled && data) setBranding(data);
			})
			.catch(() => {
				/* keep defaults when the config endpoint is unavailable */
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<BrandingContext.Provider value={branding}>
			{children}
		</BrandingContext.Provider>
	);
}

export function useBranding(): Branding {
	return useContext(BrandingContext);
}
