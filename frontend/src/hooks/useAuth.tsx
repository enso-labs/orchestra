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
			}
			if (!user) {
				fetchUser();
			}
		}, []);
	};

	useEffectGetUser();

	return { user };
}
