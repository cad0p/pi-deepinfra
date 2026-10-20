/**
 * DeepInfra footer statusline: MONTHLY DeepInfra spend only.
 *
 * pi's own footer already renders session tokens + cost (`↑in ↓out $cost`, see
 * pi's interactive footer), so this extension does not repeat them — it only
 * adds the figure pi cannot know: the account's DeepInfra spend for the current
 * month, plus the configured spending limit when one is set.
 *
 * Data sources (all verified against the live API):
 * - Monthly spend: GET https://api.deepinfra.com/payment/usage?from=current
 *   -> months[0].total_cost (integer CENTS).
 * - Configured limit: GET https://api.deepinfra.com/payment/config
 *   -> { limit } (USD; negative = no limit).
 *
 * Set `PI_DEEPINFRA_FOOTER=off` to suppress the statusline entirely.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const BILLING_BASE = "https://api.deepinfra.com";

interface DeepInfraUsageMonth {
	period?: string;
	total_cost?: number;
	items?: unknown[];
}
interface DeepInfraUsageResponse {
	months?: DeepInfraUsageMonth[];
}
interface DeepInfraConfigResponse {
	/** Spending limit in USD. Negative = no limit. */
	limit?: number;
}

interface MonthlyUsage {
	spentUsd: number;
	limitUsd: number | null;
}

/** `PI_DEEPINFRA_FOOTER=off` (or 0/false/no) disables the statusline. */
export function footerEnabled(env: (name: string) => string | undefined): boolean {
	const raw = env("PI_DEEPINFRA_FOOTER")?.trim().toLowerCase();
	return !(raw === "off" || raw === "0" || raw === "false" || raw === "no");
}

export interface UsageFooter {
	onSessionStart(ctx: ExtensionContext): Promise<void>;
	onModelSelect(ctx: ExtensionContext): void;
	onShutdown(): void;
	refreshMonthly(ctx: ExtensionContext): Promise<void>;
	render(ctx: ExtensionContext): void;
}

export function createUsageFooter(_pi: ExtensionAPI, providerId: string): UsageFooter {
	const STATUS_KEY = "deepinfra";
	let monthly: MonthlyUsage | null = null;
	let monthlyInFlight: Promise<void> | null = null;
	let enabled = true;

	const isActiveProvider = (ctx: ExtensionContext) => ctx.model?.provider === providerId;

	async function fetchMonthly(ctx: ExtensionContext): Promise<void> {
		const auth = await ctx.modelRegistry.getProviderAuth(providerId);
		const apiKey = auth?.auth.apiKey;
		if (!apiKey) return; // unconfigured — leave monthly hidden

		try {
			const headers = { Authorization: `Bearer ${apiKey}` };
			const [usageRes, configRes] = await Promise.all([
				fetch(`${BILLING_BASE}/payment/usage?from=current`, {
					headers,
					signal: ctx.signal,
				}),
				fetch(`${BILLING_BASE}/payment/config`, { headers, signal: ctx.signal }),
			]);
			if (!usageRes.ok || !configRes.ok) return;
			const usage = (await usageRes.json()) as DeepInfraUsageResponse;
			const config = (await configRes.json()) as DeepInfraConfigResponse;
			const cents = usage.months?.[0]?.total_cost;
			if (typeof cents !== "number") return;
			const limit = config.limit;
			monthly = {
				spentUsd: cents / 100,
				limitUsd: typeof limit === "number" && limit > 0 ? limit : null,
			};
		} catch {
			// keep whatever we had; the footer is decorative, never fail the turn
		}
	}

	/** Coalesced refetch: concurrent callers share one in-flight request. */
	async function refresh(ctx: ExtensionContext): Promise<void> {
		if (!monthlyInFlight) {
			monthlyInFlight = fetchMonthly(ctx).finally(() => {
				monthlyInFlight = null;
			});
		}
		await monthlyInFlight;
	}

	function render(ctx: ExtensionContext): void {
		if (!enabled || !isActiveProvider(ctx) || !monthly) {
			ctx.ui.setStatus(STATUS_KEY, undefined);
			return;
		}
		const spent = `$${monthly.spentUsd.toFixed(2)}`;
		ctx.ui.setStatus(
			STATUS_KEY,
			monthly.limitUsd != null
				? `M: ${spent} / $${monthly.limitUsd.toFixed(2)}`
				: `M: ${spent}`,
		);
	}

	return {
		async onSessionStart(ctx) {
			enabled = footerEnabled(ctx.env);
			if (!enabled) {
				render(ctx);
				return;
			}
			if (isActiveProvider(ctx)) {
				await refresh(ctx);
			}
			render(ctx);
		},
		onModelSelect(ctx) {
			if (!enabled) return;
			if (isActiveProvider(ctx)) {
				void refresh(ctx).then(() => render(ctx));
			}
			render(ctx);
		},
		onShutdown() {
			monthly = null;
		},
		async refreshMonthly(ctx) {
			monthly = null; // force refetch
			await refresh(ctx);
			render(ctx);
		},
		render,
	};
}
