export const MEMORY_KEY = "enso:chat:payload:memory";
export function getMemory(): boolean {
  if (typeof window === "undefined") return false;
	const memory = window.localStorage.getItem(MEMORY_KEY) ?? null;
	if (memory) {
		return JSON.parse(memory);
	}
	return false;
}

export function toggleMemory() {
  if (typeof window === "undefined") return;
  const memory = getMemory();
  window.localStorage.setItem(MEMORY_KEY, JSON.stringify(!memory));
}