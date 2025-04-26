
import { Link } from "react-router-dom"
import { Bot, Lock, Globe, Star, Users, Zap, PencilIcon, TrashIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAgentContext } from "@/context/AgentContext"
import { Agent } from "@/entities"

export default function AgentCard({ agent, editable = false, onDelete }: { 
  agent: Agent, 
  editable?: boolean,
  onDelete?: (id: string) => void
}) {
  const navigate = useNavigate();
  const { handleSelectAgent } = useAgentContext();
  // Extract model from settings if available
  const model = agent.setting?.value?.model || "Unknown model"
  
  // Handle categories - use default empty array if not provided
  const agentCategories = agent.categories || []
  
  return (
    <div className="bg-card text-card-foreground rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-border flex flex-col h-full">
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-primary/10 rounded-full">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-medium text-foreground">{agent.name}</h3>
              <p className="text-xs text-muted-foreground">{model}</p>
            </div>
          </div>
          
          {editable ? (
            <div className="flex space-x-1">
              <button 
                className="p-1.5 rounded-md hover:bg-secondary/80 text-muted-foreground"
                aria-label="Edit agent"
                onClick={() => {
                  handleSelectAgent(agent);
                  navigate(`/agents/${agent.id}/edit`);
                }}
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
              <button 
                className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                aria-label="Delete agent"
                onClick={() => onDelete && onDelete(agent.id)}
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            agent.public ? (
              <Globe className="h-4 w-4 text-muted-foreground/70" />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground/70" />
            )
          )}
        </div>
        
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{agent.description}</p>
        
        <div className="flex flex-wrap gap-1.5 mb-4">
          {agentCategories.map((category) => (
            <span
              key={category}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary/70 text-secondary-foreground"
            >
              {category}
            </span>
          ))}
        </div>
      </div>
      
      <div className="mt-auto border-t border-border">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center space-x-3 text-xs text-muted-foreground">
            <div className="flex items-center">
              <Users className="h-3.5 w-3.5 mr-1" />
              {agent.users || 0}
            </div>
            <div className="flex items-center">
              <Star className="h-3.5 w-3.5 mr-1 text-amber-400" />
              {agent.rating || 5.0}
            </div>
          </div>
          
          <Link
            to={`/agents/${agent.id}`}
            className="flex items-center justify-center px-3 py-1.5 rounded-md bg-primary/90 text-primary-foreground hover:bg-primary transition-colors text-xs font-medium"
          >
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            Start Chat
          </Link>
        </div>
      </div>
    </div>
  )
}