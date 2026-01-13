import { Outlet } from "react-router-dom";
import { QueryParamProvider } from "use-query-params";
import { ReactRouter6Adapter } from "use-query-params/adapters/react-router-6";

export default function App() {
	return (
		<QueryParamProvider adapter={ReactRouter6Adapter}>
			<Outlet />
		</QueryParamProvider>
	);
}
