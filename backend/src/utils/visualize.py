from datetime import datetime
from langchain_core.runnables.graph import MermaidDrawMethod


def visualize_graph(graph, name: str):
    DIR = "./sandbox/graphs"
    # Display the graph and wait for user input before continuing
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file_path = f"{DIR}/{timestamp}-{name}.png"
    try:
        graph.get_graph().draw_mermaid_png(
            draw_method=MermaidDrawMethod.API, output_file_path=output_file_path
        )
        print(f"Graph image saved to: {output_file_path}")
    except ImportError:
        ascii_graph = graph.get_graph().draw_ascii()
        with open(f"{DIR}/{timestamp}_graph.txt", "w") as f:
            f.write(ascii_graph)
        print(f"Graph ASCII art saved to: {DIR}/{timestamp}_graph.txt")
