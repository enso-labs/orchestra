import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Key, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	type ProviderKeyStatus,
	getSettings,
	upsertProviderKey,
	deleteProviderKey,
} from "@/lib/services/userSettingsService";
import { queryKeys } from "@/lib/queryKeys";

/** Human-friendly labels for provider keys */
const PROVIDER_LABELS: Record<string, string> = {
	ANTHROPIC_API_KEY: "Anthropic",
	OPENAI_API_KEY: "OpenAI",
	GROQ_API_KEY: "Groq",
	GEMINI_API_KEY: "Gemini",
	GOOGLE_API_KEY: "Google",
	XAI_API_KEY: "xAI",
	OLLAMA_BASE_URL: "Ollama",
	AWS_BEARER_TOKEN_BEDROCK: "AWS Bedrock",
	TAVILY_API_KEY: "Tavily",
	EXA_API_KEY: "Exa",
	ARCADE_API_KEY: "Arcade",
};

export function UserApiKeysSettings() {
	const [isAddOpen, setIsAddOpen] = useState(false);
	const [selectedProvider, setSelectedProvider] = useState("");
	const [apiKeyValue, setApiKeyValue] = useState("");
	const [saving, setSaving] = useState(false);
	const queryClient = useQueryClient();

	const { data: settings, isLoading: loading } = useQuery({
		queryKey: queryKeys.settings(),
		queryFn: getSettings,
	});
	const providers: ProviderKeyStatus[] = settings?.provider_keys ?? [];

	const handleUpsert = async () => {
		if (!selectedProvider || !apiKeyValue.trim()) return;
		setSaving(true);
		try {
			await upsertProviderKey(selectedProvider, apiKeyValue);
			queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
			toast.success("Provider key saved");
			handleCloseDialog();
		} catch {
			toast.error("Failed to save provider key");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (provider: string) => {
		if (
			!confirm(
				`Are you sure you want to delete your ${PROVIDER_LABELS[provider] || provider} API key? This action cannot be undone.`,
			)
		) {
			return;
		}
		try {
			await deleteProviderKey(provider);
			queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
			toast.success("Provider key deleted");
		} catch {
			toast.error("Failed to delete provider key");
		}
	};

	const handleCloseDialog = () => {
		setIsAddOpen(false);
		setSelectedProvider("");
		setApiKeyValue("");
	};

	const getLabel = (provider: string) => PROVIDER_LABELS[provider] || provider;

	return (
		<Card>
			<CardHeader>
				<div className="flex justify-between items-center">
					<div>
						<CardTitle>AI Provider Keys</CardTitle>
						<CardDescription>
							Add your own API keys for AI providers. When set, your key is used
							instead of the system default.
						</CardDescription>
					</div>
					<Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
						<DialogTrigger asChild>
							<Button>
								<Plus className="h-4 w-4 mr-2" />
								Add Key
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Add / Update Provider Key</DialogTitle>
								<DialogDescription>
									Select a provider and enter your API key. Keys are stored
									encrypted.
								</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-4">
								<div className="grid grid-cols-4 items-center gap-4">
									<Label className="text-right">Provider</Label>
									<Select
										value={selectedProvider}
										onValueChange={setSelectedProvider}
									>
										<SelectTrigger className="col-span-3">
											<SelectValue placeholder="Select provider" />
										</SelectTrigger>
										<SelectContent>
											{providers.map((p) => (
												<SelectItem key={p.provider} value={p.provider}>
													{getLabel(p.provider)}
													{p.is_set ? " (Update)" : ""}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="grid grid-cols-4 items-center gap-4">
									<Label className="text-right">API Key</Label>
									<Input
										type="password"
										value={apiKeyValue}
										onChange={(e) => setApiKeyValue(e.target.value)}
										className="col-span-3"
										placeholder="sk-..."
									/>
								</div>
							</div>
							<DialogFooter>
								<Button
									onClick={handleUpsert}
									disabled={!selectedProvider || !apiKeyValue.trim() || saving}
								>
									Save
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</CardHeader>
			<CardContent>
				{loading ? (
					<div>Loading...</div>
				) : providers.filter((p) => p.is_set).length === 0 ? (
					<div className="text-center text-muted-foreground py-8">
						No provider keys configured. Add one to use your own credentials.
					</div>
				) : (
					<div className="space-y-4">
						{providers
							.filter((p) => p.is_set)
							.map((p) => (
								<div
									key={p.provider}
									className="flex items-center justify-between p-4 border rounded-lg"
								>
									<div className="flex items-center gap-3">
										<Key className="h-4 w-4 text-muted-foreground" />
										<div>
											<div className="font-medium">{getLabel(p.provider)}</div>
											<div className="text-sm text-muted-foreground">
												Key configured
											</div>
										</div>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="text-destructive-accent hover:text-destructive-accent"
										onClick={() => handleDelete(p.provider)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
