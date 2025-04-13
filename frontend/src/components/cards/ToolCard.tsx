import { useToolContext } from "@/context/ToolContext";
import { useChatContext } from "@/context/ChatContext";
import { Play } from "lucide-react";
import styles from "@/components/ToolSelector/ToolSelector.module.css";

export default function ToolCard({ tool }: { tool: any }) {
	const { payload } = useChatContext();
	const {
		toggleTool,
		testTool,
		expanded,
		setExpanded,
		TOOL_ICONS,
	} = useToolContext();


	// Get the appropriate icon for a tool, or fall back to the default Wrench icon
  const getToolIcon = (toolId: string) => {
    const IconComponent = TOOL_ICONS[toolId.toLowerCase()] || TOOL_ICONS.default;
    return <IconComponent className="h-5 w-5" />;
  };

	return (
    <div 
      key={tool.id} 
      className={`p-3 rounded-lg border transition-all cursor-pointer relative ${
        payload.tools?.includes(tool.id) 
          ? 'bg-primary/10 border-primary/30 shadow-sm' 
          : 'bg-background hover:bg-accent/50 border-border'
      }`}
      onClick={() => toggleTool(tool.id)}
    >
      {/* Test Tool Button */}
      <button
        className={`${styles.testButton} absolute top-2 right-2 p-1 rounded-full bg-muted hover:bg-muted-foreground/20 text-muted-foreground transition-colors flex items-center`}
        onClick={(e) => testTool(tool, e)}
        title="Test this tool"
      >
        <Play className="h-3.5 w-3.5 flex-shrink-0" />
        <span className={`${styles.testButtonText} ml-1 text-xs`}>Test</span>
      </button>
      
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-full ${
          payload.tools?.includes(tool.id) 
            ? 'bg-primary/20 text-primary' 
            : 'bg-muted/60 text-muted-foreground'
        }`}>
          {getToolIcon(tool.id)}
        </div>
        
        <div className="flex-1 pr-8"> {/* Increased right padding to avoid overlap with expanded test button */}
          <h3 className="text-sm font-medium leading-none mb-1.5">
            {tool.id}
          </h3>
          
          {tool.description && tool.description.length > 100 ? (
            <div>
              <p className="text-xs text-muted-foreground">
                {expanded[tool.id] 
                  ? tool.description 
                  : `${tool.description.slice(0, 100)}...`}
              </p>
              <button 
                className="text-xs text-primary mt-1"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setExpanded({...expanded, [tool.id]: !expanded[tool.id]});
                }}
              >
                {expanded[tool.id] ? 'Show less' : 'Show more'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{tool.description}</p>
          )}
          
          <div className="flex items-center mt-1 space-x-1">
            {tool.tags && tool.tags.map((tag: string) => (
              <span key={tag} className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
            {tool.requiresInternet && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                Internet
              </span>
            )}
          </div>
          
          {tool.examples && tool.examples.length > 0 && (
            <div className="mt-2 bg-background rounded-md p-1.5">
              <p className="text-xs font-medium text-muted-foreground mb-1">Example:</p>
              <p className="text-xs italic text-foreground/70">{tool.examples[0]}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}