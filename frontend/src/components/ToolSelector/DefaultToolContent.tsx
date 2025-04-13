import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  X, Database, 
  Search, BookOpen,
  PlusCircle
} from "lucide-react";
import ToolCard from "@/components/cards/ToolCard";
import {
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";


/**
 * Default Tool Content
 * 
 * This component is used to display the default tool content.
 * It displays the tools in a grid.
 * 
 * @param enabledCount - The number of enabled tools
 * @param clearTools - The function to clear the tools
 * @param startAddingMCP - The function to start adding an MCP configuration
 * @param hasSavedMCP - Whether an MCP configuration has been saved
 * @param groupByCategory - Whether to group the tools by category
 * @param setGroupByCategory - The function to set the group by category
 */
interface DefaultToolContentProps {
  enabledCount: number;
  clearTools: () => void;
  startAddingMCP: () => void;
  hasSavedMCP: boolean;
  groupByCategory: boolean;
  setGroupByCategory: (groupByCategory: boolean) => void;
  toolFilter: string;
  setToolFilter: (toolFilter: string) => void;
  toolsByCategory: any;
  filteredTools: any;
}

const DefaultToolContent = ({ 
  enabledCount,
  clearTools, 
  startAddingMCP, 
  hasSavedMCP, 
  groupByCategory, 
  setGroupByCategory, 
  toolFilter, 
  setToolFilter, 
  toolsByCategory, 
  filteredTools 
}: DefaultToolContentProps) => {
  return (
    <div className="p-6">
      <DialogHeader className="mb-4">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-lg font-medium">
            Tools ({enabledCount} enabled)
          </DialogTitle>
          <div className="flex space-x-2">
            {enabledCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                onClick={clearTools}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
              onClick={startAddingMCP}
              title={hasSavedMCP ? "Edit or remove MCP configuration" : "Add MCP configuration"}
            >
              <PlusCircle className="h-4 w-4" />
              {hasSavedMCP && <span className="ml-1 w-2 h-2 bg-green-500 rounded-full absolute top-0 right-0"></span>}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => setGroupByCategory(!groupByCategory)}
              title={groupByCategory ? "Show as list" : "Group by category"}
            >
              {groupByCategory ? <Database className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
            </Button>
            <DialogClose className="h-7 w-7 p-0" />
          </div>
        </div>
      </DialogHeader>
      
      <p className="text-sm text-muted-foreground mb-4">
        Choose the tools that will help you be more present in this moment.
      </p>
      
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Find a tool..."
            className="w-full pl-8 p-2 text-sm rounded-md bg-background border border-input"
            onChange={(e) => setToolFilter(e.target.value)}
            value={toolFilter}
          />
          {toolFilter && (
            <button 
              className="absolute right-2 top-2.5"
              onClick={() => setToolFilter("")}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
      
      <ScrollArea className="h-[620px] sm:h-[500px] pr-3">
        <div className="grid gap-4">
          {groupByCategory ? (
            Object.entries(toolsByCategory).map(([category, tools]) => (
              <div key={category} className="mb-2">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">{category}</h3>
                <div className="grid gap-2">
                  {(tools as any[]).map((tool: any) => (
                    <ToolCard key={tool.id} tool={tool} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            filteredTools.map((tool: any) => (
              <ToolCard key={tool.id} tool={tool} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default DefaultToolContent;