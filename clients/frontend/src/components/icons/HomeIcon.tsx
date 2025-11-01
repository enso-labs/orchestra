import { Link } from "react-router-dom";

function HomeIcon({ onClick }: { onClick?: () => void }) {
	return (
		<Link
			to={onClick ? "/" : ""}
			className="flex items-center gap-2"
			onClick={onClick}
		>
			<img
				src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
				alt="Logo"
				className="w-8 h-8 rounded-full"
			/>
			<h1 className="text-2xl font-bold text-foreground">Ensō</h1>
		</Link>
	);
}

export default HomeIcon;
