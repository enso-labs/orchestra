

export function latestHumanMessage(messages: any[] | undefined | null) {
	if (!Array.isArray(messages) || messages.length === 0) {
		return null;
	}
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg && msg.type === "human") {
			return msg;
		}
	}
	return null;
}
