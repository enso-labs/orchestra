import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToolContext } from "@/context/ToolContext";

/**
 * Test Tool Content
 * 
 * This component is used to test a tool.
 * It displays the tool's description and arguments.
 * It also displays a form to test the tool with the given arguments.
 * 
 * @param testingTool - The tool to test
 * @param cancelTesting - The function to cancel the testing
 * @param handleTestFormSubmit - The function to handle the form submission
 */
interface TestToolContentProps {
  testingTool: any;
  cancelTesting: () => void;
  handleTestFormSubmit: (e: React.FormEvent) => void;
}

const TestToolContent = ({ 
  testingTool, 
  cancelTesting, 
  handleTestFormSubmit
}: TestToolContentProps) => {
  const { handleInputChange, testFormValues } = useToolContext();

  // Render form field based on argument type
  const renderFormField = (key: string, argDef: any) => {
    const type = argDef?.type || 'string';
    const title = argDef?.title || key;
    const description = argDef?.description || '';
    
    switch (type) {
      case 'string':
        return (
          <div key={key} className="mb-3">
            <Label htmlFor={key} className="text-sm font-medium">
              {title}
              {description && (
                <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
              )}
            </Label>
            <Input
              id={key}
              value={testFormValues[key] || ''}
              onChange={(e) => handleInputChange(key, e.target.value)}
              className="mt-1"
              placeholder={argDef?.placeholder || ''}
            />
          </div>
        );
        
      case 'integer':
      case 'number':
        return (
          <div key={key} className="mb-3">
            <Label htmlFor={key} className="text-sm font-medium">
              {title}
              {description && (
                <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
              )}
            </Label>
            <Input
              id={key}
              type="number"
              value={testFormValues[key] || 0}
              onChange={(e) => handleInputChange(key, Number(e.target.value))}
              className="mt-1"
            />
          </div>
        );
        
      case 'boolean':
        return (
          <div key={key} className="mb-3 flex items-center">
            <input
              id={key}
              type="checkbox"
              checked={!!testFormValues[key]}
              onChange={(e) => handleInputChange(key, e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor={key} className="ml-2 text-sm font-medium">
              {title}
              {description && (
                <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
              )}
            </Label>
          </div>
        );
        
      // For more complex types like arrays, you might need more sophisticated controls
      default:
        return (
          <div key={key} className="mb-3">
            <Label htmlFor={key} className="text-sm font-medium">
              {title} ({type})
              {description && (
                <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
              )}
            </Label>
            <Input
              id={key}
              value={typeof testFormValues[key] === 'object' 
                ? JSON.stringify(testFormValues[key]) 
                : testFormValues[key] || ''}
              onChange={(e) => {
                try {
                  // Try to parse as JSON if it's supposed to be an object/array
                  const parsed = JSON.parse(e.target.value);
                  handleInputChange(key, parsed);
                } catch {
                  // If parsing fails, store as string
                  handleInputChange(key, e.target.value);
                }
              }}
              className="mt-1"
            />
          </div>
        );
    }
  };

  return (
    <div className="p-6">
      <DialogHeader className="mb-4">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-lg font-medium">
            Test Tool: {testingTool.id}
          </DialogTitle>
          <DialogClose onClick={cancelTesting} className="h-7 w-7 p-0" />
        </div>
      </DialogHeader>
      
      <p className="text-sm text-muted-foreground mb-4">
        {testingTool.description}
      </p>
      
      <form onSubmit={handleTestFormSubmit}>
        <div className="space-y-2 mb-4">
          {testingTool.args && Object.entries(testingTool.args).map(([key, argDef]: [string, any]) => 
            renderFormField(key, argDef)
          )}
        </div>
        
        <DialogFooter className="mt-6">
          <Button 
            type="button" 
            variant="outline" 
            onClick={cancelTesting}
          >
            Cancel
          </Button>
          <Button type="submit">
            <Play className="h-4 w-4 mr-1" />
            Run Test
          </Button>
        </DialogFooter>
      </form>
    </div>
  );
}

export default TestToolContent;