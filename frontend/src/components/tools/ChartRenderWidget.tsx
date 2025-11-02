import Plot from "react-plotly.js";

import { useEffect, useState } from "react";

const ChartRenderWidget = ({ content }: { content: any }) => {
	const [plotData, setPlotData] = useState<any[]>([]);
	const [layout, setLayout] = useState<any>({});

	useEffect(() => {
		try {
			const parsedContent = JSON.parse(content);
			setPlotData(parsedContent?.data || []);
			setLayout(parsedContent?.layout || {});
		} catch (e) {
			setPlotData([]);
			setLayout({});
		}
	}, [content]);

	return (
		<div style={{ width: "100%", height: "100%" }}>
			<Plot
				data={plotData}
				layout={layout}
				useResizeHandler
				style={{ width: "100%", height: "100%" }}
				config={{ responsive: true }}
			/>
		</div>
	);
};

export default ChartRenderWidget;
