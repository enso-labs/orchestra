import { SkillDiscoveryPanel } from "@/components/skills";

export default function SkillsPage() {
	return (
		<div className="container mx-auto py-8">
			<h1 className="text-2xl font-bold mb-6">Skills Discovery</h1>
			<SkillDiscoveryPanel
				onSkillSelect={(skill) => {
					console.log("Selected skill:", skill);
				}}
			/>
		</div>
	);
}
