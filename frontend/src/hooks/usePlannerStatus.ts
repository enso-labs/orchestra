import { useState, useCallback } from "react";

interface PlannerState {
	status: "idle" | "planning" | "awaiting_approval" | "approved" | "generating";
	plan: string | null;
}

export function usePlannerStatus() {
	const [plannerState, setPlannerState] = useState<PlannerState>({
		status: "idle",
		plan: null,
	});

	const handlePlanStatus = useCallback(
		(data: { status: string; plan?: string }) => {
			setPlannerState({
				status: data.status as PlannerState["status"],
				plan: data.plan || null,
			});
		},
		[],
	);

	const approvePlan = useCallback(() => {
		setPlannerState((prev) => ({ ...prev, status: "approved" }));
	}, []);

	const rejectPlan = useCallback(() => {
		setPlannerState({ status: "idle", plan: null });
	}, []);

	const resetPlanner = useCallback(() => {
		setPlannerState({ status: "idle", plan: null });
	}, []);

	return {
		...plannerState,
		handlePlanStatus,
		approvePlan,
		rejectPlan,
		resetPlanner,
	};
}
