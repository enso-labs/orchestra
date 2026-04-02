import { useQuery } from "@tanstack/react-query";
import { getUser } from "@/lib/services/authService";
import { queryKeys } from "@/lib/queryKeys";

export type User = {
	id: string;
	username: string;
	email: string;
	name: string;
	created_at?: string;
};

export function useAuth() {
	const { data: user = null } = useQuery({
		queryKey: queryKeys.user(),
		queryFn: () => getUser().then((res) => res.data.user as User),
		staleTime: Infinity, // user data rarely changes within a session
	});

	return { user };
}
