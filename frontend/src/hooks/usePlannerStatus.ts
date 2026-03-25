import { useState, useCallback } from "react";

const VALID_STATUSES = [
	"idle",
	"planning",
	"awaiting_approval",
	"approved",
	"generating",
] as const;
type PlannerStatus = (typeof VALID_STATUSES)[number];

interface PlannerState {
	status: PlannerStatus;
	plan: string | null;
}

export function usePlannerStatus() {
	const [plannerState, setPlannerState] = useState<PlannerState>({
		status: "idle",
		plan: null,
	});

	const handlePlanStatus = useCallback(
		(data: { status: string; plan?: string }) => {
			const status = VALID_STATUSES.includes(data.status as PlannerStatus)
				? (data.status as PlannerStatus)
				: "idle";
			setPlannerState({
				status,
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
