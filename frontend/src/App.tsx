import { Outlet } from "react-router-dom";
import { QueryParamProvider } from "use-query-params";
import { ReactRouter6Adapter } from "use-query-params/adapters/react-router-6";
import { useAppContext } from "./context/AppContext";

export default function App() {
	const { useDynamicScriptInjectEffect } = useAppContext();
	useDynamicScriptInjectEffect();

	return (
		<QueryParamProvider adapter={ReactRouter6Adapter}>
			<Outlet />
		</QueryParamProvider>
	);
}
