// @vitest-environment node
//
// Contrast regression test for the two-token destructive palette (#968).
//
// This test READS THE REAL TOKEN VALUES out of src/styles/globals.css at run
// time. Nothing here hard-codes an HSL triple: editing the palette must move
// the numbers this test measures, otherwise the gate is theatre.
//
// The contract it pins (see the comment block in globals.css):
//   --destructive         fill only, sits behind --destructive-foreground
//   --destructive-accent  ink on --background / --card / --popover and the
//                         bg-destructive/5..10 tints over them
//
// Known, deliberately deferred ceilings are asserted at their MEASURED value
// rather than hidden, so the next reader sees the number:
//   * gray's --accent / --muted / --secondary (220 15% 45%) cannot host any
//     label at 4.5:1 — gray's own --accent-foreground reaches only ~4.12.
//   * light's --destructive-foreground on --destructive measures ~3.60.
// Both are tracked as deferral issues: #969 (light fill) and #970 (gray ramp).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// frontend/package.json sets "type": "module", so __dirname does not exist.
const GLOBALS_CSS = fileURLToPath(
	new URL("../../styles/globals.css", import.meta.url),
);

type Rgb = [number, number, number];
type Tokens = Record<string, string>;

/** Parse the theme token blocks out of globals.css.
 *
 * globals.css contains THREE `:root` blocks: a plain one (font-family /
 * color-scheme), one inside `@media (prefers-color-scheme: light)`, and the
 * real token block inside `@layer base`. Only blocks whose body declares
 * `--background` are theme blocks.
 */
function parseThemeBlocks(css: string): Record<string, Tokens> {
	const blocks: Record<string, Tokens> = {};
	const blockRe = /(:root|\.dark|\.gray)\s*\{([^{}]*)\}/g;
	let match: RegExpExecArray | null;
	while ((match = blockRe.exec(css)) !== null) {
		const [, selector, body] = match;
		if (!/--background\s*:/.test(body)) continue;
		const tokens: Tokens = {};
		const declRe = /--([\w-]+)\s*:\s*([^;]+);/g;
		let decl: RegExpExecArray | null;
		while ((decl = declRe.exec(body)) !== null) {
			tokens[decl[1]] = decl[2].trim();
		}
		blocks[selector] = tokens;
	}
	return blocks;
}

function hslToRgb(value: string): Rgb {
	const m = value.match(
		/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/,
	) as RegExpMatchArray | null;
	if (!m) throw new Error(`not an HSL triple: "${value}"`);
	const h = parseFloat(m[1]) / 360;
	const s = parseFloat(m[2]) / 100;
	const l = parseFloat(m[3]) / 100;

	if (s === 0) {
		const v = l * 255;
		return [v, v, v];
	}
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const hue = (t: number): number => {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}

/** Composite `fg` over the opaque `bg` at `alpha` (Tailwind's `/NN` modifier). */
function alphaComposite(fg: Rgb, bg: Rgb, alpha: number): Rgb {
	return [
		fg[0] * alpha + bg[0] * (1 - alpha),
		fg[1] * alpha + bg[1] * (1 - alpha),
		fg[2] * alpha + bg[2] * (1 - alpha),
	];
}

function relativeLuminance([r, g, b]: Rgb): number {
	const lin = (c: number): number => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const [hi, lo] = la > lb ? [la, lb] : [lb, la];
	return (hi + 0.05) / (lo + 0.05);
}

const round = (n: number): number => Math.round(n * 100) / 100;

const css = readFileSync(GLOBALS_CSS, "utf8");
const themes = parseThemeBlocks(css);

const THEME_SELECTORS = [":root", ".dark", ".gray"] as const;
const THEME_LABEL: Record<string, string> = {
	":root": "light (:root)",
	".dark": ".dark",
	".gray": ".gray",
};

describe("globals.css theme blocks", () => {
	it("finds all three theme token blocks", () => {
		expect(Object.keys(themes).sort()).toEqual(
			[...THEME_SELECTORS].sort() as string[],
		);
	});

	for (const selector of THEME_SELECTORS) {
		it(`${THEME_LABEL[selector]} declares every token this test measures`, () => {
			const tokens = themes[selector] ?? {};
			for (const name of [
				"background",
				"card",
				"popover",
				"foreground",
				"destructive",
				"destructive-foreground",
				"destructive-accent",
				"accent",
				"accent-foreground",
			]) {
				expect(
					tokens[name],
					`${THEME_LABEL[selector]} is missing --${name}`,
				).toBeDefined();
			}
		});
	}
});

for (const selector of THEME_SELECTORS) {
	describe(`destructive contrast — ${THEME_LABEL[selector]}`, () => {
		const tokens = themes[selector] ?? {};
		const rgb = (name: string): Rgb => hslToRgb(tokens[name]);

		const background = () => rgb("background");
		const accent = () => rgb("destructive-accent");
		const fill = () => rgb("destructive");

		// The tinted error container: bg-destructive/10 over the page background.
		const tint10 = () => alphaComposite(fill(), background(), 0.1);
		// The lighter variant used by ToolTestPanel: bg-destructive/5.
		const tint05 = () => alphaComposite(fill(), background(), 0.05);

		const check = (ratio: number, min: number, surface: string): void => {
			expect(
				ratio,
				`expected >= ${min}, got ${round(ratio)} for ${selector}/${surface}`,
			).toBeGreaterThanOrEqual(min);
		};

		// --- accent as TEXT: WCAG 1.4.3, 4.5:1 -------------------------------

		it("accent ink clears 4.5:1 on --background", () => {
			check(contrast(accent(), background()), 4.5, "background");
		});

		// --card and --popover happen to equal --background in all three themes
		// today. That coincidence is exactly what this pins: if a future theme
		// splits them, the accent must still be legible on each.
		it("accent ink clears 4.5:1 on --card", () => {
			check(contrast(accent(), rgb("card")), 4.5, "card");
		});

		it("accent ink clears 4.5:1 on --popover", () => {
			check(contrast(accent(), rgb("popover")), 4.5, "popover");
		});

		it("accent ink clears 4.5:1 on the bg-destructive/10 tint", () => {
			check(contrast(accent(), tint10()), 4.5, "background@0.10");
		});

		it("accent ink clears 4.5:1 on the bg-destructive/5 tint", () => {
			check(contrast(accent(), tint05()), 4.5, "background@0.05");
		});

		// --- banner prose ----------------------------------------------------

		it("--foreground prose clears 4.5:1 on the bg-destructive/10 tint", () => {
			check(contrast(rgb("foreground"), tint10()), 4.5, "foreground@0.10");
		});

		// --- accent as BORDER: WCAG 1.4.11, 3:1 ------------------------------
		// The banner border is border-destructive-accent/70, so the border pixel
		// is the accent composited at 0.70 — over the page background outside the
		// container, and over the tint inside it.

		it("border accent at /70 clears 3:1 against the page background", () => {
			const border = alphaComposite(accent(), background(), 0.7);
			check(contrast(border, background()), 3.0, "border@0.70 vs background");
		});

		it("border accent at /70 clears 3:1 against the tint", () => {
			const border = alphaComposite(accent(), tint10(), 0.7);
			check(contrast(border, tint10()), 3.0, "border@0.70 vs background@0.10");
		});

		// --- guard: why the second token exists ------------------------------
		// The raw fill token as ink fails in EVERY theme, light included (3.30).
		// If this ever passes, --destructive has been redefined and the whole
		// two-token split needs revisiting.

		it("the raw fill token as ink still fails 4.5:1 on the tint", () => {
			const ratio = contrast(fill(), tint10());
			expect(
				ratio,
				`--destructive as ink measured ${round(ratio)} on ${selector}/background@0.10; ` +
					`if this now clears 4.5 the fill token was redefined and the ` +
					`two-token contract in globals.css must be re-derived`,
			).toBeLessThan(4.5);
		});
	});
}

// --- documented ceilings, asserted at their measured value -----------------

describe("documented ceilings (deferred: #969, #970)", () => {
	it("gray's --accent surface cannot host any label at 4.5:1 — the ceiling is the ramp, not our token", () => {
		const gray = themes[".gray"] ?? {};
		const surface = hslToRgb(gray["accent"]);

		// Our token is icon-safe there (WCAG 1.4.11) but not text-safe.
		const accentRatio = contrast(hslToRgb(gray["destructive-accent"]), surface);
		expect(
			accentRatio,
			`expected >= 3.0, got ${round(accentRatio)} for .gray/accent (icon-safe floor)`,
		).toBeGreaterThanOrEqual(3.0);

		// Proof the ceiling is a property of the gray ramp: gray's OWN
		// --accent-foreground does not clear 4.5 on its own --accent either.
		const ownRatio = contrast(hslToRgb(gray["accent-foreground"]), surface);
		expect(
			ownRatio,
			`.gray's own --accent-foreground measures ${round(ownRatio)} on --accent; ` +
				`if this now clears 4.5 the gray ramp was fixed and the deferral ` +
				`issue #970 can be closed`,
		).toBeLessThan(4.5);
	});

	it("light's --destructive-foreground on --destructive is held at the 3:1 floor, not 4.5", () => {
		// Measures ~3.60 in light: a real AA failure on every destructive button
		// label, deliberately out of scope for #968 because fixing it means
		// mutating --destructive. Tracked as #969.
		const light = themes[":root"] ?? {};
		const ratio = contrast(
			hslToRgb(light["destructive-foreground"]),
			hslToRgb(light["destructive"]),
		);
		expect(
			ratio,
			`expected >= 3.0, got ${round(ratio)} for :root/destructive-foreground on destructive`,
		).toBeGreaterThanOrEqual(3.0);
	});
});
