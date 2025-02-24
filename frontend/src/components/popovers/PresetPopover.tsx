import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatContext } from "@/context/ChatContext";
import apiClient from "@/lib/utils/apiClient";
import { deleteSetting } from "../../services/settingService";
import { toast } from "sonner";

export function PresetPopover() {
  const [isCreating, setIsCreating] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [filterText, setFilterText] = useState("");
  const { payload, settings, setPayload, useSettingsEffect, fetchSettings, setPreset, preset } = useChatContext();

  const handleCreatePreset = async () => {
    if (!presetName.trim()) return;
    
    try {
      const response = await apiClient.post('/settings', {
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
        const response = await apiClient.put(`/settings/${preset.id}`, {
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUpdatePreset(setting)}
                      >
                        <Save className="h-4 w-4 text-primary" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePreset(setting.id)}
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