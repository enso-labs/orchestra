import { useState, useCallback } from "react";

interface CostState {
	totalCost: number;
	turnCount: number;
	costByPhase: Record<string, number>;
	totalInputTokens: number;
	totalOutputTokens: number;
}

export function useCostTracking() {
	const [costState, setCostState] = useState<CostState>({
		totalCost: 0,
		turnCount: 0,
		costByPhase: {},
		totalInputTokens: 0,
		totalOutputTokens: 0,
	});

	const handleCostUpdate = useCallback(
		(data: {
			cost_usd: number;
			input_tokens: number;
			output_tokens: number;
			phase: string;
		}) => {
			setCostState((prev) => ({
				totalCost: prev.totalCost + data.cost_usd,
				turnCount: prev.turnCount + 1,
				costByPhase: {
					...prev.costByPhase,
					[data.phase]: (prev.costByPhase[data.phase] || 0) + data.cost_usd,
				},
				totalInputTokens: prev.totalInputTokens + data.input_tokens,
				totalOutputTokens: prev.totalOutputTokens + data.output_tokens,
			}));
		},
		[],
	);

	const resetCost = useCallback(() => {
		setCostState({
			totalCost: 0,
			turnCount: 0,
			costByPhase: {},
			totalInputTokens: 0,
			totalOutputTokens: 0,
		});
	}, []);

	return { ...costState, handleCostUpdate, resetCost };
}
