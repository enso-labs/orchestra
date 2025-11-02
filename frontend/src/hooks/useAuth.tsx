import { getUser } from "@/lib/services/authService";
import { useEffect, useState } from "react";

export type User = {
	id: string;
	username: string;
	email: string;
	name: string;
	created_at?: string;
};

export function useAuth() {
	const [user, setUser] = useState<User | null>(null);

	const useEffectGetUser = () => {
		useEffect(() => {
			async function fetchUser() {
				const res = await getUser();
				setUser(res.data.user);
				if (res.data.env?.PRESIDIO_ANALYZE_HOST) {
					localStorage.setItem("enso:checkbox:pii_analyze", "true");
				} else {
					localStorage.removeItem("enso:checkbox:pii_analyze");
				}
				if (res.data.env?.PRESIDIO_ANONYMIZE_HOST) {
					localStorage.setItem("enso:checkbox:pii_anonymize", "true");
				} else {
					localStorage.removeItem("enso:checkbox:pii_anonymize");
				}
			}
			if (!user) {
				fetchUser();
			}
		}, []);
	};

	useEffectGetUser();

	return { user };
}
