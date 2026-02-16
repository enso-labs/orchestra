import Plotly from "plotly.js-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";

const Plot = createPlotlyComponent(Plotly);

import { useEffect, useState } from "react";

// Fixed dimensions to prevent layout shifts during streaming
const CHART_HEIGHT = 400;
const CHART_MIN_HEIGHT = 300;
const CHART_MAX_HEIGHT = 600;

const ChartRenderWidget = ({ content }: { content: any }) => {
	const [plotData, setPlotData] = useState<any[]>([]);
	const [layout, setLayout] = useState<any>({});

	useEffect(() => {
		try {
			const parsedContent = JSON.parse(content);
			setPlotData(parsedContent?.data || []);
			setLayout(parsedContent?.layout || {});
		} catch (_e) {
			setPlotData([]);
			setLayout({});
		}
	}, [content]);

	return (
		<div
			style={{
				width: "100%",
				height: `${CHART_HEIGHT}px`,
				minHeight: `${CHART_MIN_HEIGHT}px`,
				maxHeight: `${CHART_MAX_HEIGHT}px`,
				position: "relative",
			}}
		>
			<Plot
				data={plotData}
				layout={{
					...layout,
					autosize: true,
					height: CHART_HEIGHT,
				}}
				useResizeHandler={false}
				style={{ width: "100%", height: "100%" }}
				config={{
					responsive: false,
					displayModeBar: true,
					displaylogo: false,
				}}
			/>
		</div>
	);
};

export default ChartRenderWidget;
