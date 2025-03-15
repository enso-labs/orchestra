import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import AuthLayout from "../layouts/AuthLayout"
import { Bot, Lock, Globe, Star, Users, Zap, Search, X, PencilIcon, TrashIcon, PlusIcon } from "lucide-react"

// Agent categories
const categories = [
  "Research",
  "Writing",
  "Coding",
  "Data Analysis",
  "Customer Support",
  "Creative",
  "Finance",
  "Education",
]

// Mock data - replace with real data
const publicAgents = [
  {
    id: "1",
    name: "Research Assistant",
    description: "Expert at analyzing academic papers and research",
    model: "GPT-4o",
    users: 1205,
    rating: 4.8,
    isPublic: true,
    categories: ["Research", "Education"],
  },
  {
    id: "2",
    name: "Code Wizard",
    description: "Helps with programming tasks and debugging code",
    model: "Claude 3",
    users: 3420,
    rating: 4.9,
    isPublic: true,
    categories: ["Coding"],
  },
  {
    id: "3",
    name: "Content Writer",
    description: "Creates engaging blog posts and marketing copy",
    model: "GPT-4o",
    users: 2150,
    rating: 4.7,
    isPublic: true,
    categories: ["Writing", "Creative"],
  },
  {
    id: "4",
    name: "Data Analyst",
    description: "Analyzes and visualizes complex datasets",
    model: "Claude 3",
    users: 980,
    rating: 4.6,
    isPublic: true,
    categories: ["Data Analysis"],
  },
  {
    id: "5",
    name: "Customer Support",
    description: "Handles customer inquiries and troubleshooting",
    model: "GPT-4o",
    users: 1750,
    rating: 4.5,
    isPublic: true,
    categories: ["Customer Support"],
  },
  {
    id: "6",
    name: "Creative Assistant",
    description: "Helps with brainstorming and creative projects",
    model: "Claude 3",
    users: 1320,
    rating: 4.7,
    isPublic: true,
    categories: ["Creative"],
  },
  {
    id: "7",
    name: "Financial Advisor",
    description: "Provides financial analysis and investment advice",
    model: "GPT-4o",
    users: 890,
    rating: 4.6,
    isPublic: true,
    categories: ["Finance"],
  },
  {
    id: "8",
    name: "Study Buddy",
    description: "Helps with homework and exam preparation",
    model: "Claude 3",
    users: 2450,
    rating: 4.8,
    isPublic: true,
    categories: ["Education"],
  },
  {
    id: "9",
    name: "Technical Writer",
    description: "Creates documentation and technical guides",
    model: "GPT-4o",
    users: 760,
    rating: 4.5,
    isPublic: true,
    categories: ["Writing", "Coding"],
  },
  {
    id: "10",
    name: "Market Researcher",
    description: "Analyzes market trends and competitor data",
    model: "Claude 3",
    users: 1050,
    rating: 4.7,
    isPublic: true,
    categories: ["Research", "Data Analysis"],
  },
  {
    id: "11",
    name: "Email Assistant",
    description: "Drafts and organizes emails efficiently",
    model: "GPT-4o",
    users: 3100,
    rating: 4.9,
    isPublic: true,
    categories: ["Writing"],
  },
  {
    id: "12",
    name: "Social Media Manager",
    description: "Creates and schedules social media content",
    model: "Claude 3",
    users: 1870,
    rating: 4.6,
    isPublic: true,
    categories: ["Writing", "Creative"],
  },
]

const privateAgents = [
  {
    id: "p1",
    name: "Custom Analyst",
    description: "Personalized financial analysis assistant",
    model: "GPT-4o",
    users: 3,
    rating: 5.0,
    isPublic: false,
    categories: ["Finance", "Data Analysis"],
  },
  {
    id: "p2",
    name: "Personal Researcher",
    description: "Trained on your company's research papers",
    model: "Claude 3",
    users: 5,
    rating: 4.9,
    isPublic: false,
    categories: ["Research"],
  },
  {
    id: "p3",
    name: "Team Coder",
    description: "Specialized in your codebase and tech stack",
    model: "GPT-4o",
    users: 8,
    rating: 4.8,
    isPublic: false,
    categories: ["Coding"],
  },
  {
    id: "p4",
    name: "Brand Writer",
    description: "Writes in your company's tone and style",
    model: "Claude 3",
    users: 4,
    rating: 4.7,
    isPublic: false,
    categories: ["Writing", "Creative"],
  },
  {
    id: "p5",
    name: "Internal Support",
    description: "Handles employee questions about company policies",
    model: "GPT-4o",
    users: 12,
    rating: 4.9,
    isPublic: false,
    categories: ["Customer Support"],
  },
  {
    id: "p6",
    name: "Project Manager",
    description: "Helps track and manage team projects",
    model: "Claude 3",
    users: 7,
    rating: 4.8,
    isPublic: false,
    categories: ["Data Analysis"],
  },
]

// Add an "owner" field to the Agent type
type Agent = {
  id: string
  name: string
  description: string
  model: string
  users: number
  rating: number
  isPublic: boolean
  categories: string[]
  owner?: string // Add this field to track ownership
}

// Add a few example "my agents" for the demo
const myAgents = [
  {
    id: "m1",
    name: "My Research Helper",
    description: "Customized for my research workflow",
    model: "GPT-4o",
    users: 1,
    rating: 5.0,
    isPublic: false,
    categories: ["Research", "Writing"],
    owner: "current-user-id" // This would come from auth context in real app
  },
  {
    id: "m2",
    name: "Personal Coding Assistant",
    description: "Trained on my coding style and projects",
    model: "Claude 3",
    users: 1,
    rating: 4.9,
    isPublic: false,
    categories: ["Coding"],
    owner: "current-user-id"
  },
  // More examples as needed
]

function AgentCard({ agent, editable = false }: { agent: Agent, editable?: boolean }) {
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
              <p className="text-xs text-muted-foreground">{agent.model}</p>
            </div>
          </div>
          
          {editable ? (
            <div className="flex space-x-1">
              <button 
                className="p-1.5 rounded-md hover:bg-secondary/80 text-muted-foreground"
                aria-label="Edit agent"
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
              <button 
                className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                aria-label="Delete agent"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            agent.isPublic ? (
              <Globe className="h-4 w-4 text-muted-foreground/70" />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground/70" />
            )
          )}
        </div>
        
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{agent.description}</p>
        
        <div className="flex flex-wrap gap-1.5 mb-4">
          {agent.categories.map((category) => (
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
              {agent.users.toLocaleString()}
            </div>
            <div className="flex items-center">
              <Star className="h-3.5 w-3.5 mr-1 text-amber-400" />
              {agent.rating}
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Bot className="h-16 w-16 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground">{message}</h3>
      <p className="text-sm text-muted-foreground/70 mt-2">Try adjusting your search or filters</p>
    </div>
  )
}

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [filteredPublicAgents, setFilteredPublicAgents] = useState(publicAgents)
  const [filteredPrivateAgents, setFilteredPrivateAgents] = useState(privateAgents)
  const [filteredMyAgents, setFilteredMyAgents] = useState(myAgents)
  const [activeTab, setActiveTab] = useState("public")

  // Filter agents based on search term and selected categories
  useEffect(() => {
    const filterAgents = (agents: Agent[]) => {
      return agents.filter((agent) => {
        const matchesSearch =
          agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          agent.description.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesCategories =
          selectedCategories.length === 0 || selectedCategories.some((cat) => agent.categories.includes(cat))

        return matchesSearch && matchesCategories
      })
    }

    setFilteredPublicAgents(filterAgents(publicAgents).map(agent => ({
      ...agent,
      owner: agent.owner || '' // Ensure owner is always a string
    })))
    setFilteredPrivateAgents(filterAgents(privateAgents).map(agent => ({
      ...agent, 
      owner: agent.owner || ''
    })))
    setFilteredMyAgents(filterAgents(myAgents).map(agent => ({
      ...agent,
      owner: agent.owner || ''
    })))
  }, [searchTerm, selectedCategories])

  // Toggle category selection
  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    )
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("")
    setSelectedCategories([])
  }

  // Log to help debug
  console.log("Dashboard rendering", { filteredPublicAgents, filteredPrivateAgents, filteredMyAgents })

  return (
    <AuthLayout>
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6">
        <div className="flex flex-col space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Choose Your Agent</h1>
              <p className="text-muted-foreground mt-1">Select an AI agent to help with your specific needs</p>
            </div>
          </div>

          {/* Search and filters */}
          <div className="bg-background/50 backdrop-blur-sm sticky top-0 z-10 pb-4">
            <div className="flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search agents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-10 pl-9 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/70 transition-all"
                  />
                  {searchTerm && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={() => setSearchTerm("")}
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {selectedCategories.length > 0 && (
                  <button
                    className="h-10 px-3 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors"
                    onClick={clearFilters}
                  >
                    Clear Filters ({selectedCategories.length})
                    <X className="ml-2 h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {categories.map((category) => (
                  <button
                    key={category}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                      selectedCategories.includes(category)
                        ? "bg-primary/90 text-primary-foreground hover:bg-primary"
                        : "bg-secondary/60 text-secondary-foreground hover:bg-secondary/80"
                    }`}
                    onClick={() => toggleCategory(category)}
                  >
                    {category}
                    {selectedCategories.includes(category) && <X className="ml-1 h-3 w-3" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Updated Tabs */}
          <div className="w-full">
            <div className="flex space-x-1 border-b border-border">
              <button
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === "public"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("public")}
              >
                Public
                {filteredPublicAgents.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                    {filteredPublicAgents.length}
                  </span>
                )}
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === "private"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("private")}
              >
                Private
                {filteredPrivateAgents.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                    {filteredPrivateAgents.length}
                  </span>
                )}
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === "mine"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("mine")}
              >
                Mine
                {filteredMyAgents.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                    {filteredMyAgents.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab content */}
            <div className="mt-4">
              {activeTab === "public" && (
                <div className="h-[calc(100vh-22rem)] overflow-auto pr-2">
                  {filteredPublicAgents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
                      {filteredPublicAgents.map((agent) => (
                        <AgentCard key={agent.id} agent={agent} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No public agents found" />
                  )}
                </div>
              )}

              {activeTab === "private" && (
                <div className="h-[calc(100vh-22rem)] overflow-auto pr-2">
                  {filteredPrivateAgents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
                      {filteredPrivateAgents.map((agent) => (
                        <AgentCard key={agent.id} agent={agent} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No private agents found" />
                  )}
                </div>
              )}
              
              {activeTab === "mine" && (
                <div className="h-[calc(100vh-22rem)] overflow-auto pr-2">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-medium">My Agents</h2>
                    <button className="flex items-center justify-center px-3 py-1.5 rounded-md bg-primary/90 text-primary-foreground hover:bg-primary transition-colors text-xs font-medium">
                      <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                      Create New Agent
                    </button>
                  </div>
                  
                  {filteredMyAgents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
                      {filteredMyAgents.map((agent) => (
                        <AgentCard key={agent.id} agent={agent} editable={true} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="You don't have any agents yet" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </AuthLayout>
  )
}