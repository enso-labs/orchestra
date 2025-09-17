export const handleStopReason = (response_metadata: any) => {
	const reason =
		response_metadata.finish_reason || response_metadata.stop_reason;
	if (["stop", "end_turn"].includes(reason)) {
		return true;
	}
	return false;
};
