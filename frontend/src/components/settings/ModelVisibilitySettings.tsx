import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useModelVisibility } from "@/hooks/useModelVisibility";
import { useChatContext } from "@/context/ChatContext";

function getProvider(modelId: string) {
	const [provider] = modelId.split(":");
	return provider || "other";
}

function getModelName(modelId: string) {
	const [, name] = modelId.split(":");
	return name || modelId;
}

const PROVIDER_ORDER = [
	"openai",
	"anthropic",
	"google",
	"google_genai",
	"google-vertexai",
	"groq",
	"xai",
	"ollama",
	"other",
];

export function ModelVisibilitySettings() {
	const { models, useModelsEffect } = useChatContext();
	const { isModelVisible, toggleModelVisibility } = useModelVisibility();

	// Ensure models are loaded on the Settings page as well.
	useModelsEffect?.();

	const allModels: string[] = models?.models || [];
	const grouped = allModels.reduce<Record<string, string[]>>((acc, modelId) => {
		const provider = getProvider(modelId);
		acc[provider] = acc[provider] || [];
		acc[provider].push(modelId);
		return acc;
	}, {});

	const providerKeys = Object.keys(grouped).sort((a, b) => {
		const aIdx = PROVIDER_ORDER.indexOf(a);
		const bIdx = PROVIDER_ORDER.indexOf(b);
		if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
		if (aIdx === -1) return 1;
		if (bIdx === -1) return -1;
		return aIdx - bIdx;
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Model Visibility</CardTitle>
				<CardDescription>
					Toggle which models appear in the model selector.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{allModels.length === 0 ? (
					<div className="text-muted-foreground">No models available.</div>
				) : (
					<Accordion type="multiple" className="w-full">
						{providerKeys.map((provider) => {
							const modelsForProvider = (grouped[provider] || []).slice();
							modelsForProvider.sort((a, b) =>
								getModelName(a).localeCompare(getModelName(b)),
							);

							const visibleCount = modelsForProvider.filter((m) =>
								isModelVisible(m),
							).length;

							return (
								<AccordionItem key={provider} value={provider}>
									<AccordionTrigger className="hover:no-underline">
										<div className="flex w-full items-center justify-between gap-3">
											<span className="capitalize">{provider}</span>
											<span className="text-xs text-muted-foreground tabular-nums">
												{visibleCount}/{modelsForProvider.length} shown
											</span>
										</div>
									</AccordionTrigger>
									<AccordionContent className="pt-1">
										<div className="space-y-3">
											{modelsForProvider.map((modelId) => (
												<div
													key={modelId}
													className="flex items-center justify-between gap-3"
												>
													<Label
														htmlFor={`model-${modelId}`}
														className="flex-1"
													>
														<div className="flex flex-col">
															<span className="font-medium">
																{getModelName(modelId)}
															</span>
															<span className="text-xs text-muted-foreground font-mono">
																{modelId}
															</span>
														</div>
													</Label>
													<Switch
														id={`model-${modelId}`}
														checked={isModelVisible(modelId)}
														onCheckedChange={() =>
															toggleModelVisibility(modelId)
														}
													/>
												</div>
											))}
										</div>
									</AccordionContent>
								</AccordionItem>
							);
						})}
					</Accordion>
				)}
			</CardContent>
		</Card>
	);
}
