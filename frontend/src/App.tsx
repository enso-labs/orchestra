import { Outlet } from "react-router-dom";
import { QueryParamProvider } from "use-query-params";
import { ReactRouter6Adapter } from "use-query-params/adapters/react-router-6";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function App() {
	// Bind document.title to chat/streaming status
	useDocumentTitle();

	return (
		<QueryParamProvider adapter={ReactRouter6Adapter}>
			<Outlet />
		</QueryParamProvider>
	);
}
