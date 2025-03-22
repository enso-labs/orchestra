import { useState } from "react";
import AuthLayout from "../layouts/AuthLayout";
import { Box, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function CreateAgent() {
  const [activeTab, setActiveTab] = useState("create");
  const [agentName, setAgentName] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const [agentInstructions, setAgentInstructions] = useState("");
  const [conversationStarters, setConversationStarters] = useState([""]);

  const handleAddConversationStarter = () => {
    setConversationStarters([...conversationStarters, ""]);
  };

  const handleConversationStarterChange = (index: number, value: string) => {
    const updatedStarters = [...conversationStarters];
    updatedStarters[index] = value;
    setConversationStarters(updatedStarters);
  };

  const handleRemoveConversationStarter = (index: number) => {
    if (conversationStarters.length > 1) {
      const updatedStarters = [...conversationStarters];
      updatedStarters.splice(index, 1);
      setConversationStarters(updatedStarters);
    }
  };

  return (
    <AuthLayout>
      
    </AuthLayout>
  );
} 