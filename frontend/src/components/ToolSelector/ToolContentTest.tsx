import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

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
  renderFormField: (key: string, argDef: any) => React.ReactNode;
}

const TestToolContent = ({ 
  testingTool, 
  cancelTesting, 
  handleTestFormSubmit, 
  renderFormField 
}: TestToolContentProps) => {
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