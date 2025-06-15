import { useToolContext } from "@/context/ToolContext";
import FullScreenLayout from "@/layouts/FullScreenLayout";
import AgentCreateMobile from "./agent-create-mobile";
import OverlayEdit from "./components/OverlayEdit";
import ResizeablePanel from "./components/ResizeablePanel";
import useAgentHook from "./hooks/useAgentHook";

export default function AgentCreate() {
  const { isFullscreen } = useAgentHook();
  const { useSpecEffect } = useToolContext();

  useSpecEffect();

  return (
    <FullScreenLayout>
      {/* Fullscreen textarea overlay */}
      {isFullscreen && <OverlayEdit />}
      
      <AgentCreateMobile />

      {/* Desktop view with resizable panels */}
      <ResizeablePanel />
    </FullScreenLayout>
  );
} 