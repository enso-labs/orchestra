import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TOKEN_NAME, VITE_API_URL } from "../lib/config";
import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import { SiGoogle, SiGithub } from "react-icons/si";
import { FaMicrosoft } from "react-icons/fa";
import type { IconType } from "react-icons";
import {
	ArrowUpRight,
	BookOpen,
	CheckCircle2,
	Github,
	ShieldCheck,
	Sparkles,
	Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const externalLinks = [
	{
		href: "https://ruska.ai",
		label: "Website",
	},
	{
		href: "https://docs.ruska.ai",
		label: "Docs",
	},
	{
		href: "https://github.com/ruska-ai/orchestra",
		label: "GitHub",
	},
] as const;

const trustPoints = [
	{
		icon: Workflow,
		title: "Guided autonomy",
		description:
			"Shape agent behavior with steerable workflows, prompts, memories, and scheduling from one control plane.",
	},
	{
		icon: ShieldCheck,
		title: "Production guardrails",
		description:
			"Move from prototype to reliable operations with shareable threads, project context, and explicit controls.",
	},
	{
		icon: Sparkles,
		title: "Open deployment path",
		description:
			"Run Orchestra in the cloud or self-host under Apache 2.0 while keeping the same product surface.",
	},
] as const;

const authProviders: Array<{
	icon: IconType;
	label: string;
	onClick?: () => void;
	disabled?: boolean;
}> = [
	{
		icon: SiGoogle,
		label: "Google",
		disabled: true,
	},
	{
		icon: SiGithub,
		label: "GitHub",
	},
	{
		icon: FaMicrosoft,
		label: "Microsoft",
		disabled: true,
	},
];

export default function Login() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const navigate = useNavigate();

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			const response = await fetch(`${VITE_API_URL}/auth/login`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email,
					password,
				}),
			});

			if (response.ok) {
				const data = await response.json();
				// Store JWT token in localStorage
				localStorage.setItem(TOKEN_NAME, data.access_token);
				localStorage.setItem("enso:auth:user", JSON.stringify(data.user));
				navigate("/chat");
			} else {
				const errorData = await response.json();
				setError(errorData.detail || "Invalid credentials");
			}
		} catch {
			setError("Failed to connect to server");
		} finally {
			setIsLoading(false);
		}
	};

	const handleOAuthLogin = async (provider: string) => {
		try {
			const res = await fetch(`${VITE_API_URL}/auth/${provider}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			});
			const data = await res.json();
			window.location.href = data.url;
		} catch (error) {
			console.error("Error:", error);
			alert("Error: " + error);
		}
	};

	return (
		<div className="h-full overflow-y-auto bg-background text-foreground">
			<div className="relative min-h-full overflow-hidden">
				<div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
				<div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.18),transparent_60%)]" />
				<div className="absolute right-[-8rem] top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
				<div className="absolute bottom-0 left-[-6rem] h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

				<header className="relative z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
					<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
						<a
							href="https://ruska.ai"
							className="flex items-center gap-3 transition-opacity hover:opacity-85"
						>
							<img
								src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
								alt="Ruska Labs"
								className="h-11 w-11 rounded-full ring-1 ring-border/60"
							/>
							<div>
								<p className="font-montserrat text-[11px] uppercase tracking-[0.35em] text-green-500">
									Ruska Labs
								</p>
								<p className="font-cormorant text-2xl font-semibold tracking-[0.2em]">
									ORCHESTRA
								</p>
							</div>
						</a>

						<div className="flex items-center gap-2 sm:gap-3">
							<nav className="hidden items-center gap-5 md:flex">
								{externalLinks.map((link) => (
									<a
										key={link.label}
										href={link.href}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1 font-montserrat text-sm text-muted-foreground transition-colors hover:text-foreground"
									>
										{link.label}
										<ArrowUpRight className="h-3.5 w-3.5" />
									</a>
								))}
							</nav>
							<ColorModeButton />
						</div>
					</div>
				</header>

				<main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-14 lg:pt-10">
					<div className="grid w-full items-stretch gap-6 lg:grid-cols-[minmax(0,29rem)_minmax(0,1fr)] xl:gap-10">
						<section className="order-1">
							<div className="rounded-[2rem] border border-border/70 bg-card/85 p-6 shadow-[0_30px_120px_-50px_rgba(15,23,42,0.75)] backdrop-blur-xl sm:p-8">
								<div className="mb-6 space-y-4">
									<div className="inline-flex items-center gap-2 rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1">
										<CheckCircle2 className="h-4 w-4 text-green-500" />
										<span className="font-montserrat text-xs font-medium uppercase tracking-[0.24em] text-green-500">
											App Login
										</span>
									</div>
									<div className="space-y-3">
										<h1 className="font-cormorant text-4xl font-semibold leading-none text-foreground sm:text-5xl">
											Sign in to steer agents with precision.
										</h1>
										<p className="max-w-md font-montserrat text-sm leading-6 text-muted-foreground sm:text-[15px]">
											Continue from the Ruska site into Orchestra with
											email/password or GitHub OAuth. Registration stays one
											click away if you are new here.
										</p>
									</div>
								</div>

								<form onSubmit={handleLogin} className="space-y-5">
									{error && (
										<div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
											{error}
										</div>
									)}

									<div className="space-y-2">
										<label
											htmlFor="email"
											className="font-montserrat text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground"
										>
											Email
										</label>
										<input
											id="email"
											type="email"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											className="h-12 w-full rounded-2xl border border-border bg-background/80 px-4 font-montserrat text-sm shadow-sm transition-colors focus:border-green-500/50 focus:outline-none focus:ring-2 focus:ring-green-500/20"
											placeholder="you@company.com"
											required
										/>
									</div>

									<div className="space-y-2">
										<label
											htmlFor="password"
											className="font-montserrat text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground"
										>
											Password
										</label>
										<input
											id="password"
											type="password"
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											className="h-12 w-full rounded-2xl border border-border bg-background/80 px-4 font-montserrat text-sm shadow-sm transition-colors focus:border-green-500/50 focus:outline-none focus:ring-2 focus:ring-green-500/20"
											placeholder="Enter your password"
											required
										/>
									</div>

									<div className="grid gap-3 sm:grid-cols-2">
										<button
											type="submit"
											disabled={isLoading}
											className="inline-flex h-12 items-center justify-center rounded-2xl bg-foreground px-4 font-montserrat text-sm font-semibold text-background transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
										>
											{isLoading ? "Signing in..." : "Sign in"}
										</button>
										<Link
											to="/register"
											className="inline-flex h-12 items-center justify-center rounded-2xl border border-border bg-background/70 px-4 font-montserrat text-sm font-semibold text-foreground transition-colors hover:border-green-500/40 hover:bg-green-500/5"
										>
											Create free account
										</Link>
									</div>

									<div className="relative py-2">
										<div className="absolute inset-0 flex items-center">
											<div className="w-full border-t border-border/70" />
										</div>
										<div className="relative flex justify-center">
											<span className="bg-card px-3 font-montserrat text-xs uppercase tracking-[0.22em] text-muted-foreground">
												Or continue with
											</span>
										</div>
									</div>

									<div className="grid gap-3 sm:grid-cols-3">
										{authProviders.map((provider) => {
											const Icon = provider.icon;
											return (
												<button
													key={provider.label}
													type="button"
													disabled={provider.disabled}
													onClick={
														provider.label === "GitHub"
															? () => handleOAuthLogin("github")
															: undefined
													}
													className={cn(
														"inline-flex h-12 items-center justify-center gap-2 rounded-2xl border px-4 font-montserrat text-sm font-medium transition-colors",
														provider.disabled
															? "cursor-not-allowed border-border/70 bg-muted/30 text-muted-foreground/70"
															: "border-border bg-background/70 text-foreground hover:border-green-500/40 hover:bg-green-500/5",
													)}
													aria-label={`Sign in with ${provider.label}`}
												>
													<Icon className="h-4 w-4" />
													<span>{provider.label}</span>
												</button>
											);
										})}
									</div>

									<p className="font-montserrat text-xs leading-5 text-muted-foreground">
										GitHub OAuth is available now. Google and Microsoft stay
										visible here so the SSO path remains obvious as those
										providers come online.
									</p>
								</form>
							</div>
						</section>

						<section className="order-2">
							<div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-green-500/20 bg-gradient-to-br from-green-500/10 via-card/80 to-background/80 p-6 shadow-[0_30px_120px_-50px_rgba(34,197,94,0.35)] backdrop-blur-xl sm:p-8 xl:p-10">
								<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_35%)]" />
								<div className="relative space-y-8">
									<div className="inline-flex items-center gap-2 rounded-full border border-green-500/25 bg-green-500/10 px-4 py-2">
										<ShieldCheck className="h-4 w-4 text-green-500" />
										<span className="font-montserrat text-xs font-medium uppercase tracking-[0.24em] text-green-600 dark:text-green-400">
											Open-Source · Apache 2.0
										</span>
									</div>

									<div className="max-w-2xl space-y-4">
										<p className="font-montserrat text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
											The app destination after ruska.ai
										</p>
										<h2 className="font-cormorant text-5xl font-semibold leading-[0.92] text-foreground sm:text-6xl">
											Guided autonomy with production guardrails.
										</h2>
										<p className="max-w-2xl font-montserrat text-base leading-7 text-muted-foreground sm:text-lg">
											Orchestra gives your team one control room for prompts,
											memories, schedules, and shared execution history. Use it
											to move from demo-grade agents to deliberate operational
											systems.
										</p>
									</div>

									<div className="grid gap-4 xl:grid-cols-3">
										{trustPoints.map((point) => {
											const Icon = point.icon;
											return (
												<div
													key={point.title}
													className="rounded-[1.5rem] border border-border/70 bg-background/55 p-5"
												>
													<div className="mb-4 inline-flex items-center gap-3">
														<div className="rounded-full border border-green-500/25 bg-green-500/10 p-2">
															<Icon className="h-4 w-4 text-green-500" />
														</div>
														<h3 className="font-space text-lg font-bold text-foreground">
															{point.title}
														</h3>
													</div>
													<p className="font-montserrat text-sm leading-6 text-muted-foreground">
														{point.description}
													</p>
												</div>
											);
										})}
									</div>

									<div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
										<div className="rounded-[1.75rem] border border-border/70 bg-background/55 p-6">
											<p className="font-montserrat text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
												Why this page exists now
											</p>
											<p className="mt-4 font-cormorant text-3xl font-semibold leading-tight text-foreground">
												The public app entry now goes straight to sign-in
												instead of an anonymous landing detour.
											</p>
											<p className="mt-4 font-montserrat text-sm leading-6 text-muted-foreground">
												That keeps the handoff from the marketing site explicit,
												preserves `/login` for deep links, and keeps
												authenticated users on the fast path back to `/chat`.
											</p>
										</div>

										<div className="rounded-[1.75rem] border border-border/70 bg-background/55 p-6">
											<p className="font-montserrat text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
												Trust markers
											</p>
											<ul className="mt-4 space-y-3">
												<li className="flex items-start gap-3 font-montserrat text-sm text-muted-foreground">
													<BookOpen className="mt-0.5 h-4 w-4 text-green-500" />
													<span>
														Docs and source stay one click away from login.
													</span>
												</li>
												<li className="flex items-start gap-3 font-montserrat text-sm text-muted-foreground">
													<Github className="mt-0.5 h-4 w-4 text-green-500" />
													<span>
														GitHub OAuth is live now for faster team access.
													</span>
												</li>
												<li className="flex items-start gap-3 font-montserrat text-sm text-muted-foreground">
													<ShieldCheck className="mt-0.5 h-4 w-4 text-green-500" />
													<span>Cloud and self-hosted paths stay aligned.</span>
												</li>
											</ul>
										</div>
									</div>
								</div>
							</div>
						</section>
					</div>
				</main>

				<footer className="relative z-10 border-t border-border/60 bg-background/70 backdrop-blur-xl">
					<div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
						<p className="font-montserrat text-xs uppercase tracking-[0.24em] text-muted-foreground">
							Steerable harnesses for DeepAgents
						</p>
						<div className="flex flex-wrap items-center gap-4 font-montserrat text-sm text-muted-foreground">
							{externalLinks.map((link) => (
								<a
									key={link.label}
									href={link.href}
									target="_blank"
									rel="noopener noreferrer"
									className="transition-colors hover:text-foreground"
								>
									{link.label}
								</a>
							))}
						</div>
					</div>
				</footer>
			</div>
		</div>
	);
}
