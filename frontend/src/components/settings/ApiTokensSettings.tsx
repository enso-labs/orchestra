import React, { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import apiClient from "@/lib/utils/apiClient";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export interface ApiToken {
	id: string;
	name: string;
	prefix: string;
	created_at: string;
	last_used_at: string | null;
}

export function ApiTokensSettings() {
	const [tokens, setTokens] = useState<ApiToken[]>([]);
	const [loading, setLoading] = useState(true);
	const [newTokenName, setNewTokenName] = useState("");
	const [createdToken, setCreatedToken] = useState<string | null>(null);
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	React.useEffect(() => {
		fetchTokens();
	}, []);

	const fetchTokens = async () => {
		try {
			setLoading(true);
			const res = await apiClient.get<ApiToken[]>("/api/tokens");
			if (Array.isArray(res.data)) {
				setTokens(res.data);
			} else {
				console.error("API returned non-array tokens:", res.data);
				setTokens([]);
			}
		} catch (err) {
			console.error("Failed to fetch tokens", err);
			toast.error("Failed to load API tokens");
			setTokens([]);
		} finally {
			setLoading(false);
		}
	};

	const createToken = async () => {
		if (!newTokenName.trim()) return;
		try {
			const res = await apiClient.post("/tokens", { name: newTokenName });
			setCreatedToken(res.data.token);
			setTokens([...tokens, res.data.api_token]);
			setNewTokenName("");
			toast.success("API Token created");
		} catch (err) {
			console.error("Failed to create token", err);
			toast.error("Failed to create API token");
		}
	};

	const deleteToken = async (id: string) => {
		try {
			await apiClient.delete(`/tokens/${id}`);
			setTokens(tokens.filter((t) => t.id !== id));
			toast.success("API Token revoked");
		} catch (err) {
			console.error("Failed to delete token", err);
			toast.error("Failed to revoke API token");
		}
	};

	const handleCloseCreate = () => {
		setIsCreateOpen(false);
		setCreatedToken(null);
		setNewTokenName("");
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex justify-between items-center">
					<div>
						<CardTitle>API Tokens</CardTitle>
						<CardDescription>
							Manage your API tokens for programmatic access.
						</CardDescription>
					</div>
					<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
						<DialogTrigger asChild>
							<Button>
								<Plus className="h-4 w-4 mr-2" />
								Create Token
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Create API Token</DialogTitle>
								<DialogDescription>
									Enter a name for your new API token.
								</DialogDescription>
							</DialogHeader>

							{!createdToken ? (
								<div className="grid gap-4 py-4">
									<div className="grid grid-cols-4 items-center gap-4">
										<Label htmlFor="name" className="text-right">
											Name
										</Label>
										<Input
											id="name"
											value={newTokenName}
											onChange={(e) => setNewTokenName(e.target.value)}
											className="col-span-3"
											placeholder="My Agent Token"
										/>
									</div>
								</div>
							) : (
								<div className="grid gap-4 py-4">
									<div className="p-4 bg-muted rounded-md break-all relative group">
										<code className="text-sm">{createdToken}</code>
										<Button
											size="icon"
											variant="ghost"
											className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
											onClick={() => {
												navigator.clipboard.writeText(createdToken);
												toast.success("Copied to clipboard");
												alert(`Copied to clipboard`);
											}}
										>
											<Copy className="h-4 w-4" />
										</Button>
									</div>
									<p className="text-sm text-destructive">
										Make sure to copy your token now. You won't be able to see
										it again!
									</p>
								</div>
							)}

							<DialogFooter>
								{!createdToken ? (
									<Button onClick={createToken} disabled={!newTokenName.trim()}>
										Create
									</Button>
								) : (
									<Button onClick={handleCloseCreate}>Done</Button>
								)}
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</CardHeader>
			<CardContent>
				{loading ? (
					<div>Loading...</div>
				) : tokens.length === 0 ? (
					<div className="text-center text-muted-foreground py-8">
						No API tokens found. Create one to get started.
					</div>
				) : (
					<div className="space-y-4">
						{tokens.map((token) => (
							<div
								key={token.id}
								className="flex items-center justify-between p-4 border rounded-lg"
							>
								<div>
									<div className="font-medium">{token.name}</div>
									<div className="text-sm text-muted-foreground font-mono">
										{token.prefix}
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Created: {new Date(token.created_at).toLocaleDateString()}
										{token.last_used_at &&
											` • Last used: ${new Date(token.last_used_at).toLocaleDateString()}`}
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon"
									className="text-destructive hover:text-destructive/90"
									onClick={() => deleteToken(token.id)}
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
