import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, X, Settings, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Action {
  id: string;
  name: string;
  type: 'api' | 'function' | 'tool' | 'webhook';
  description: string;
  configuration: Record<string, any>;
}

interface ActionManagerProps {
  actions?: Action[];
  onActionsChange?: (actions: Action[]) => void;
}

export default function ActionManager({ actions = [], onActionsChange }: ActionManagerProps) {
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAction, setNewAction] = useState<Partial<Action>>({
    name: '',
    type: 'api',
    description: '',
    configuration: {}
  });

  const handleAddAction = () => {
    if (!newAction.name || !newAction.type) return;
    
    const action: Action = {
      id: Date.now().toString(),
      name: newAction.name,
      type: newAction.type as Action['type'],
      description: newAction.description || '',
      configuration: newAction.configuration || {}
    };

    const updatedActions = [...actions, action];
    onActionsChange?.(updatedActions);
    
    // Reset form
    setNewAction({
      name: '',
      type: 'api',
      description: '',
      configuration: {}
    });
    setIsAddDialogOpen(false);
  };

  const handleRemoveAction = (actionId: string) => {
    const updatedActions = actions.filter(action => action.id !== actionId);
    onActionsChange?.(updatedActions);
  };

  const handleConfigureAction = (action: Action) => {
    setSelectedAction(action);
    setIsConfigDialogOpen(true);
  };

  const handleSaveConfiguration = () => {
    if (!selectedAction) return;
    
    const updatedActions = actions.map(action => 
      action.id === selectedAction.id ? selectedAction : action
    );
    onActionsChange?.(updatedActions);
    
    setIsConfigDialogOpen(false);
    setSelectedAction(null);
  };

  const getActionTypeColor = (type: Action['type']) => {
    switch (type) {
      case 'api': return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'function': return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'tool': return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      case 'webhook': return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const renderConfigurationForm = (action: Action) => {
    const { type, configuration } = action;
    
    switch (type) {
      case 'api':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="endpoint">Endpoint URL</Label>
              <Input
                id="endpoint"
                value={configuration.endpoint || ''}
                onChange={(e) => setSelectedAction({
                  ...action,
                  configuration: { ...configuration, endpoint: e.target.value }
                })}
                placeholder="https://api.example.com/endpoint"
              />
            </div>
            <div>
              <Label htmlFor="method">HTTP Method</Label>
              <Select
                value={configuration.method || 'GET'}
                onValueChange={(value) => setSelectedAction({
                  ...action,
                  configuration: { ...configuration, method: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="headers">Headers (JSON)</Label>
              <Textarea
                id="headers"
                value={configuration.headers ? JSON.stringify(configuration.headers, null, 2) : '{}'}
                onChange={(e) => {
                  try {
                    const headers = JSON.parse(e.target.value);
                    setSelectedAction({
                      ...action,
                      configuration: { ...configuration, headers }
                    });
                  } catch {
                    // Invalid JSON, ignore for now
                  }
                }}
                rows={4}
                className="font-mono"
              />
            </div>
          </div>
        );
      
      case 'function':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="functionCode">Function Code</Label>
              <Textarea
                id="functionCode"
                value={configuration.code || ''}
                onChange={(e) => setSelectedAction({
                  ...action,
                  configuration: { ...configuration, code: e.target.value }
                })}
                rows={8}
                className="font-mono"
                placeholder="function execute(input) {\n  // Your code here\n  return result;\n}"
              />
            </div>
            <div>
              <Label htmlFor="parameters">Parameters (JSON)</Label>
              <Textarea
                id="parameters"
                value={configuration.parameters ? JSON.stringify(configuration.parameters, null, 2) : '[]'}
                onChange={(e) => {
                  try {
                    const parameters = JSON.parse(e.target.value);
                    setSelectedAction({
                      ...action,
                      configuration: { ...configuration, parameters }
                    });
                  } catch {
                    // Invalid JSON, ignore for now
                  }
                }}
                rows={4}
                className="font-mono"
              />
            </div>
          </div>
        );
      
      case 'tool':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="toolName">Tool Name</Label>
              <Input
                id="toolName"
                value={configuration.toolName || ''}
                onChange={(e) => setSelectedAction({
                  ...action,
                  configuration: { ...configuration, toolName: e.target.value }
                })}
                placeholder="calculator"
              />
            </div>
            <div>
              <Label htmlFor="toolConfig">Configuration (JSON)</Label>
              <Textarea
                id="toolConfig"
                value={configuration.config ? JSON.stringify(configuration.config, null, 2) : '{}'}
                onChange={(e) => {
                  try {
                    const config = JSON.parse(e.target.value);
                    setSelectedAction({
                      ...action,
                      configuration: { ...configuration, config }
                    });
                  } catch {
                    // Invalid JSON, ignore for now
                  }
                }}
                rows={6}
                className="font-mono"
              />
            </div>
          </div>
        );
      
      case 'webhook':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                value={configuration.url || ''}
                onChange={(e) => setSelectedAction({
                  ...action,
                  configuration: { ...configuration, url: e.target.value }
                })}
                placeholder="https://hooks.example.com/webhook"
              />
            </div>
            <div>
              <Label htmlFor="secret">Secret Key</Label>
              <Input
                id="secret"
                type="password"
                value={configuration.secret || ''}
                onChange={(e) => setSelectedAction({
                  ...action,
                  configuration: { ...configuration, secret: e.target.value }
                })}
                placeholder="Optional webhook secret"
              />
            </div>
            <div>
              <Label htmlFor="payload">Payload Template (JSON)</Label>
              <Textarea
                id="payload"
                value={configuration.payload ? JSON.stringify(configuration.payload, null, 2) : '{}'}
                onChange={(e) => {
                  try {
                    const payload = JSON.parse(e.target.value);
                    setSelectedAction({
                      ...action,
                      configuration: { ...configuration, payload }
                    });
                  } catch {
                    // Invalid JSON, ignore for now
                  }
                }}
                rows={6}
                className="font-mono"
              />
            </div>
          </div>
        );
      
      default:
        return (
          <div className="text-center py-8 text-muted-foreground">
            No configuration options available for this action type.
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Actions</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Add and configure actions that your Enso can perform
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsAddDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Action
        </Button>
      </div>

      {/* Actions Display */}
      {actions.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Badge 
                key={action.id}
                variant="secondary"
                className={`${getActionTypeColor(action.type)} cursor-pointer group relative px-3 py-2 text-sm`}
                onClick={() => handleConfigureAction(action)}
              >
                <span className="mr-2">{action.name}</span>
                <span className="text-xs opacity-75">({action.type})</span>
                <div className="ml-2 flex items-center gap-1">
                  <Settings className="h-3 w-3" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAction(action.id);
                    }}
                    className="ml-1 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <Card className="p-6 text-center border-dashed">
          <div className="space-y-2">
            <Plus className="h-8 w-8 mx-auto text-muted-foreground" />
            <h3 className="font-medium">No actions configured</h3>
            <p className="text-sm text-muted-foreground">
              Add actions to give your Enso specific capabilities
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsAddDialogOpen(true)}
            >
              Add Your First Action
            </Button>
          </div>
        </Card>
      )}

      {/* Add Action Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Action</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="actionName">Action Name</Label>
              <Input
                id="actionName"
                value={newAction.name || ''}
                onChange={(e) => setNewAction({ ...newAction, name: e.target.value })}
                placeholder="e.g., Send Email, Calculate Price"
              />
            </div>
            <div>
              <Label htmlFor="actionType">Action Type</Label>
              <Select
                value={newAction.type || 'api'}
                onValueChange={(value) => setNewAction({ ...newAction, type: value as Action['type'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">API Call</SelectItem>
                  <SelectItem value="function">Custom Function</SelectItem>
                  <SelectItem value="tool">External Tool</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="actionDescription">Description</Label>
              <Textarea
                id="actionDescription"
                value={newAction.description || ''}
                onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                placeholder="What does this action do?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAction} disabled={!newAction.name || !newAction.type}>
              Add Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Action Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Configure Action: {selectedAction?.name}
              <Badge variant="outline" className={getActionTypeColor(selectedAction?.type || 'api')}>
                {selectedAction?.type}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="configName">Action Name</Label>
              <Input
                id="configName"
                value={selectedAction?.name || ''}
                onChange={(e) => setSelectedAction(selectedAction ? { ...selectedAction, name: e.target.value } : null)}
              />
            </div>
            <div>
              <Label htmlFor="configDescription">Description</Label>
              <Textarea
                id="configDescription"
                value={selectedAction?.description || ''}
                onChange={(e) => setSelectedAction(selectedAction ? { ...selectedAction, description: e.target.value } : null)}
                rows={2}
              />
            </div>
            
            <div className="border-t pt-4">
              <Label className="text-sm font-medium mb-3 block">Configuration</Label>
              {selectedAction && renderConfigurationForm(selectedAction)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                if (selectedAction) {
                  handleRemoveAction(selectedAction.id);
                  setIsConfigDialogOpen(false);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button onClick={handleSaveConfiguration}>
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 