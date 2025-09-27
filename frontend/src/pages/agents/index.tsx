import { ColorModeButton } from "@/components/buttons/ColorModeButton";
import { MainToolTip } from "@/components/tooltips/MainToolTip";
import { Button } from "@/components/ui/button";
import HouseIcon from "@/components/icons/HouseIcon";
import { Plus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";

function AgentIndexPage() {
	const navigate = useNavigate();
	const [, setSearchParams] = useSearchParams();

	useEffect(() => {
		setSearchParams(new URLSearchParams());
	}, []);

	return (
		<div className="h-full flex flex-col">
			<div className="absolute top-4 right-4">
				<div className="flex flex-row gap-2 items-center">
					<MainToolTip content="New Agent" delayDuration={500}>
						<Button
							variant="outline"
							size="icon"
							onClick={() => navigate("/agents/create")}
						>
							<Plus className="h-4 w-4" />
						</Button>
					</MainToolTip>
					<ColorModeButton />
				</div>
			</div>
			<div className="absolute top-4 left-4">
				<div className="flex flex-row gap-2 items-center">
					<Button variant="outline" size="icon" onClick={() => navigate("/")}>
						<HouseIcon />
					</Button>
				</div>
			</div>
		</div>
	);
}

export default AgentIndexPage;
