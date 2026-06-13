import { useBranding } from "@/context/BrandingContext";

export default function HelpfulIcons() {
	const branding = useBranding();
	return (
		<div className="text-center flex justify-center gap-2 my-3">
			<a
				href={branding.urls.docs}
				target="_blank"
				className="hover:opacity-80 transition-opacity"
				rel="noreferrer"
			>
				<img
					src="https://img.shields.io/badge/View%20Documentation-Docs-blue"
					alt="Documentation"
				/>
			</a>
			<a
				href={`${branding.urls.github}/cloud`}
				target="_blank"
				className="hover:opacity-80 transition-opacity"
				rel="noreferrer"
			>
				<img
					src="https://img.shields.io/badge/Join%20our%20community-Github-black"
					alt="Github"
				/>
			</a>
		</div>
	);
}
