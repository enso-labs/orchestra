// @vitest-environment node
//
// Usage gate for the two-token destructive palette (#968).
//
// destructive-contrast.test.ts pins the PALETTE arithmetic, but it stays green
// while someone re-adds the bare fill token as ink tomorrow — and that copy-
// paste, not a bad token value, is what actually caused #968. This gate walks
// frontend/src and fails on any use of the fill token as text or border.
//
// Allowed:   bg-destructive (the legitimate fill)
//            text-destructive-foreground (the label ON that fill)
//            text-/border-destructive-accent (ink on a surface)
// Rejected:  everything else that puts --destructive on text or a border,
//            including opacity variants and state prefixes.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Explicit, EMPTY BY DEFAULT allowlist.
 *
 * If an occurrence must legitimately survive, add it here WITH A WRITTEN
 * REASON so the exception shows up as a visible diff in review rather than
 * passing silently. Entries are `src`-relative POSIX paths.
 */
const ALLOWLIST: Array<{ file: string; reason: string }> = [];

const ALLOWED_FILES = new Set(ALLOWLIST.map((entry) => entry.file));

// Built by concatenation so this gate's own source does not contain the
// literal string it forbids (it scans itself like every other file).
const TOKEN = "destructive";

// Matched per OCCURRENCE, with token boundaries on both sides — deliberately
// NOT the `grep -v -- '-foreground'` line filter used for the one-off sweep.
// That filter drops any whole LINE containing `text-muted-foreground`, which
// hid four real `hover:` sites during the sweep; a line-level exclusion cannot
// express "this line has both a legal and an illegal use". The lookahead does.
//
//   (?<![\w-])   left boundary: not mid-identifier (blocks `foo-text-...`)
//   (?:text|border)-destructive
//   (?![-\w])    right boundary: rejects `-foreground`, `-accent`, and
//                `-ness`-style suffixes, while allowing `/70`, `"`, space, `<`
//
// Pinned below by MUST_MATCH / MUST_NOT_MATCH so the regex cannot silently rot.
const VIOLATION = new RegExp(`(?<![\\w-])(?:text|border)-${TOKEN}(?![-\\w])`);

/** Literal examples that MUST be flagged. Built from TOKEN so this file does
 * not self-trip on its own fixtures. */
const MUST_MATCH = [
	`text-${TOKEN}`,
	`text-${TOKEN}/70`,
	`text-${TOKEN}/90`,
	`border-${TOKEN}/40`,
	`hover:text-${TOKEN}`,
	`focus:text-${TOKEN}`,
	`dark:border-${TOKEN}`,
	// the sweep's blind spot: a legal and an illegal use on the same line
	`className="text-muted-foreground hover:text-${TOKEN}"`,
	`className="mt-1 text-xs text-${TOKEN}/70 break-all"`,
];

/** Literal examples that MUST NOT be flagged. */
const MUST_NOT_MATCH = [
	`bg-${TOKEN}`, // the legitimate fill
	`bg-${TOKEN}/10`, // the legitimate tint
	`bg-${TOKEN}/5`,
	`hover:bg-${TOKEN}/90`,
	`text-${TOKEN}-foreground`, // the label ON the fill
	`text-${TOKEN}-accent`, // ink on a surface
	`text-${TOKEN}-accent/90`,
	`border-${TOKEN}-accent`,
	`border-${TOKEN}-accent/70`,
	`focus:text-${TOKEN}-accent`,
	`--${TOKEN}-accent`,
	`className="text-${TOKEN}-accent border-${TOKEN}-foreground"`,
	`text-${TOKEN}ness`, // not the utility at all
];

const CONTRACT = [
	`The bare --${TOKEN} token is a FILL. It is not legible as ink on any`,
	`surface: it measures 3.30 / 1.93 / 1.08 (light/dark/gray) as text.`,
	``,
	`Use instead:`,
	`  - tinted error CONTAINER  -> prose is text-foreground; put`,
	`                               text-${TOKEN}-accent on the icon and`,
	`                               border-${TOKEN}-accent/70 on the border`,
	`  - inline error TEXT       -> text-${TOKEN}-accent`,
	`  - a filled button/badge   -> bg-${TOKEN} + text-${TOKEN}-foreground`,
	``,
	`Never add an opacity modifier to either token as text — alpha composites`,
	`toward the surface and always lowers the ratio.`,
	``,
	`Full contract: the comment block above :root in src/styles/globals.css.`,
	`If an occurrence must legitimately remain, add it to ALLOWLIST in`,
	`src/tests/styles/${TOKEN}-usage.test.ts with a written reason.`,
].join("\n");

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === "node_modules" || entry === "dist") continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			walk(full, out);
		} else if (/\.tsx?$/.test(entry)) {
			out.push(full);
		}
	}
	return out;
}

describe(`${TOKEN} token usage gate — the matcher itself`, () => {
	for (const example of MUST_MATCH) {
		it(`flags: ${example}`, () => {
			expect(
				VIOLATION.test(example),
				`the gate FAILED TO FLAG a violation: ${example}`,
			).toBe(true);
		});
	}

	for (const example of MUST_NOT_MATCH) {
		it(`allows: ${example}`, () => {
			expect(
				VIOLATION.test(example),
				`the gate WRONGLY FLAGGED a legitimate use: ${example}`,
			).toBe(false);
		});
	}
});

describe(`${TOKEN} token usage gate`, () => {
	it("no file uses the fill token as text or border", () => {
		const violations: string[] = [];

		for (const file of walk(SRC_ROOT)) {
			const rel = file.slice(SRC_ROOT.length).replace(/\\/g, "/");
			if (ALLOWED_FILES.has(rel)) continue;

			const lines = readFileSync(file, "utf8").split("\n");
			lines.forEach((line, index) => {
				if (VIOLATION.test(line)) {
					violations.push(`${rel}:${index + 1}: ${line.trim()}`);
				}
			});
		}

		expect(
			violations,
			violations.length
				? `Found ${violations.length} use(s) of the fill token as ink:\n\n` +
						violations.join("\n") +
						`\n\n${CONTRACT}\n`
				: "",
		).toEqual([]);
	});

	it("every allowlist entry carries a reason and still exists", () => {
		for (const entry of ALLOWLIST) {
			expect(
				entry.reason.trim().length,
				`allowlist entry ${entry.file} has no written reason`,
			).toBeGreaterThan(0);
		}
	});
});
