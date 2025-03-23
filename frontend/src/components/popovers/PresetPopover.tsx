import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Plus, Save, Trash2, Box } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatContext } from "@/context/ChatContext";
import { createSetting, deleteSetting, updateSetting } from "@/services/settingService";
import { createAgent } from "@/services/agentService";
import { toast } from "sonner";

export function PresetPopover() {
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [filterText, setFilterText] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const [agentPublic, setAgentPublic] = useState(false);
  const { payload, settings, setPayload, useSettingsEffect, fetchSettings, setPreset, preset } = useChatContext();

  const handleCreatePreset = async () => {
    if (!presetName.trim()) return;
    
    try {
      const response = await createSetting({
        name: presetName,
        value: {
          system: payload.system,
          model: payload.model,
          tools: payload.tools,
        }
      });

      if (response.status === 201) {
        setPresetName("");
        setIsCreating(false);
        await fetchSettings();
        toast.success("Preset created successfully");
      }
    } catch (error) {
      console.error('Failed to create preset:', error);
      toast.error("Failed to create preset");
    }
  };

  const handleCreateAgent = async () => {
    if (!agentName.trim() || !preset) return;
    
    try {
      await createAgent({
        name: agentName,
        description: agentDescription,
        settings_id: preset.id,
        public: agentPublic
      });
      
      setAgentName("");
      setAgentDescription("");
      setAgentPublic(false);
      setIsCreatingAgent(false);
      toast.success("Agent created successfully");
    } catch (error) {
      console.error('Failed to create agent:', error);
      toast.error("Failed to create agent");
    }
  };

  const handleSelectPreset = (preset: any) => {
    setPreset(preset);
    setPayload((prev: any) => ({
      ...prev,
      system: preset.value.system || prev.system,
      model: preset.value.model || prev.model,
      tools: preset.value.tools || [],
    }));
    toast.success("Preset applied");
  };

  const handleDeletePreset = async (id: string) => {
    try {
      if (confirm(`Are you sure you want to delete (${settings.find((preset: any) => preset.id === id)?.name}) preset?`)) {
        await deleteSetting(id);
        await fetchSettings();
        toast.success("Preset deleted successfully");
      }
    } catch (error) {
      console.error('Failed to delete preset:', error);
      toast.error("Failed to delete preset");
    }
  };

  const handleUpdatePreset = async (preset: any) => {
    if (confirm(`Are you sure you want to update (${preset.name}) preset?`)) {
      try {
        const response = await updateSetting(preset.id, {
          name: preset.name,
          value: {
          system: payload.system,
          model: payload.model,
          tools: payload.tools,
        }
      });

      if (response.status === 200) {
        toast.success("Preset updated successfully");
      }
    } catch (error) {
      console.error('Failed to update preset:', error);
      toast.error("Failed to update preset");
    } finally {
      await fetchSettings();
    }
  };
  }

  const filteredSettings = settings.filter((preset: any) =>
    preset.name.toLowerCase().includes(filterText.toLowerCase())
  ).sort((a: any, b: any) => a.name.localeCompare(b.name));

  useSettingsEffect();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="rounded-full bg-foreground/10 text-foreground-500">
          <Save className="h-4 w-4" /> {preset?.name || "Presets"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Presets</h4>
            <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-input rounded-md"
            placeholder="Filter presets..."
          />

          {isCreating && (
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="flex-1 px-3 py-2 bg-background border border-input rounded-md"
                placeholder="Preset name"
              />
              <Button onClick={handleCreatePreset}>Save</Button>
            </div>
          )}

          {/* Agent creation form - only shown if a preset is selected */}
          {preset && isCreatingAgent && (
            <div className="space-y-2 p-2 border border-input rounded-md">
              <h5 className="font-medium">Create Agent from Preset</h5>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-md"
                placeholder="Agent name"
              />
              <textarea
                value={agentDescription}
                onChange={(e) => setAgentDescription(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-md"
                placeholder="Agent description"
                rows={3}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="agentPublic"
                  checked={agentPublic}
                  onChange={(e) => setAgentPublic(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="agentPublic">Public agent</label>
              </div>
              <div className="flex gap-2 mt-2">
                <Button onClick={handleCreateAgent} className="flex-1">Create Agent</Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreatingAgent(false)} 
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {filteredSettings.map((setting: any) => (
                <div 
                  key={setting.name} 
                  className={`flex items-center justify-between p-2 hover:bg-accent rounded-md ${
                    setting.id === preset?.id ? 'bg-accent' : ''
                  }`}
                >
                  <button
                    onClick={() => handleSelectPreset(setting)}
                    className="flex-1 text-left"
                  >
                    {setting.name}
                  </button>
                  <div className="flex gap-1">
                    {setting.id === preset?.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUpdatePreset(setting)}
                          title="Update preset"
                        >
                          <Save className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsCreatingAgent(!isCreatingAgent)}
                          title="Create agent from preset"
                        >
                          <Box className="h-4 w-4 text-primary" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePreset(setting.id)}
                        title="Delete preset"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
} 