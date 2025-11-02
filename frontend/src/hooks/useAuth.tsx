import { getUser } from "@/lib/services/authService";
import { useEffect, useState } from "react";

export type User = {
	id: string;
	username: string;
	email: string;
	name: string;
	created_at?: string;
};

function envChecks(env: any) {
	const piiAnalyze = !!env?.PRESIDIO_ANALYZE_HOST;
	const piiAnonymize = !!env?.PRESIDIO_ANONYMIZE_HOST;

	if (piiAnalyze) {
		localStorage.setItem("enso:checkbox:pii_analyze", "true");
	} else {
		localStorage.removeItem("enso:checkbox:pii_analyze");
	}

	if (piiAnonymize) {
		localStorage.setItem("enso:checkbox:pii_anonymize", "true");
	} else {
		localStorage.removeItem("enso:checkbox:pii_anonymize");
	}
}

export function useAuth() {
	const [user, setUser] = useState<User | null>(null);

	const useEffectGetUser = () => {
		useEffect(() => {
			async function fetchUser() {
				const res = await getUser();
				setUser(res.data.user);
				envChecks(res.data.env);
			}
			if (!user) {
				fetchUser();
			}
		}, []);
	};

	useEffectGetUser();

	return { user };
}
