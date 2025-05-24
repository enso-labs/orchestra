import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { listToolsArcade } from "@/services/toolService"
import { useChatContext } from "@/context/ChatContext"

type Tool = {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
}

type ToolsTabProps = {
  category?: string
  onToolToggle?: (toolId: string, isEnabled: boolean) => void
}

const CATEGORIES = [
	// "All", 
	// "Asana", 
	"CodeSandbox", 
	// "Dropbox", 
	"Github", 
	"Google", 
	// "Hubspot", 
	// "Linkedin", 
	"Math",
	// "Microsoft",
	// "Notion",
	// "Reddit",
	"Search",
	// "Slack",
	// "Spotify",
	"Web",
	// "X",
	// "Zoom"
]

const STORAGE_KEY = 'enso:chat:payload:arcade'

export function TabContentArcade({ category }: ToolsTabProps) {
	const { setPayload } = useChatContext();
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>(category || "All")
  const [visibleTools, setVisibleTools] = useState<Tool[]>([])
  const [, setPage] = useState(1)
  const [allTools, setAllTools] = useState<Tool[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [enabledTools, setEnabledTools] = useState<Set<string>>(new Set())
  const loaderRef = useRef<HTMLDivElement>(null)
  const ITEMS_PER_PAGE = 6

  // Fetch tools from API
  const fetchTools = async (pageNum: number) => {
    setIsLoading(true)
    try {
      const offset = (pageNum - 1) * ITEMS_PER_PAGE
      // Use selectedCategory as toolkit filter, but only if it's not "All"
      const toolkit = searchQuery ? searchQuery : undefined;
      const response = await listToolsArcade(toolkit, offset, ITEMS_PER_PAGE)
      
      // Map API response to our Tool type
      const mappedTools = response.data.items.map((tool: any) => ({
        id: tool.fully_qualified_name,
        name: tool.name,
        description: tool.description,
        category: tool.toolkit.name,
        tags: [tool.toolkit.name, ...(tool.input?.parameters?.map((p: any) => p.name) || [])]
      }))

      // Check if we have more data to load
      setHasMore(response.data.items.length === ITEMS_PER_PAGE)
      
      if (pageNum === 1) {
        setAllTools(mappedTools)
      } else {
        setAllTools(prev => [...prev, ...mappedTools])
      }
    } catch (error) {
      console.error('Error fetching tools:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Reset page and fetch tools when category changes
  useEffect(() => {
    setPage(1)
    fetchTools(1)
  }, [selectedCategory])

  // Filter tools based on search query, category, and pagination
  useEffect(() => {
    let filtered = [...allTools]

    // Filter by tab category if provided
    if (category) {
      filtered = filtered.filter((tool) => tool.category === category)
    }

    // Filter by selected category (if not "All")
    if (selectedCategory !== "All" && !category) {
      filtered = filtered.filter((tool) => tool.category === selectedCategory)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (tool) =>
          tool.name.toLowerCase().includes(query) ||
          tool.description.toLowerCase().includes(query) ||
          tool.tags.some((tag) => tag.toLowerCase().includes(query)),
      )
    }

    setVisibleTools(filtered)
  }, [selectedCategory, category, allTools])

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setPage((prevPage) => {
            const nextPage = prevPage + 1
            fetchTools(nextPage)
            return nextPage
          })
        }
      },
      { threshold: 1.0 },
    )

    if (loaderRef.current) {
      observer.observe(loaderRef.current)
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current)
      }
    }
  }, [hasMore, isLoading])

  // Load initial state from localStorage
  useEffect(() => {
    const storedArcade = localStorage.getItem(STORAGE_KEY)
    if (storedArcade) {
      try {
        const arcadeData = JSON.parse(storedArcade)
        // Handle both old and new storage formats
        const tools = Array.isArray(arcadeData) ? arcadeData : arcadeData.tools || []
        setEnabledTools(new Set(tools))
        setPayload((prev: any) => ({
          ...prev,
          arcade: {
            tools: tools,
            toolkit: arcadeData.toolkit || []
          }
        }))
      } catch (error) {
        console.error('Error loading arcade tools from localStorage:', error)
      }
    }
  }, [])

  const handleToolToggle = (toolId: string, isEnabled: boolean) => {
    setEnabledTools(prev => {
      const newSet = new Set(prev)
      if (isEnabled) {
        newSet.add(toolId)
      } else {
        newSet.delete(toolId)
      }
      return newSet
    })

    // Update payload.arcade list and localStorage
    setPayload((prev: any) => {
      const currentArcade = prev.arcade || { tools: [], toolkit: [] }
      let newArcade = { ...currentArcade }
      
      if (isEnabled) {
        // Add tool if not already in the list
        if (!currentArcade.tools.includes(toolId)) {
          newArcade.tools = [...currentArcade.tools, toolId]
        }
      } else {
        // Remove tool from the list
        newArcade.tools = currentArcade.tools.filter((id: string) => id !== toolId)
      }

      // Update localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newArcade))
      
      return {
        ...prev,
        arcade: newArcade
      }
    })
  }

  const handleClearSelection = () => {
    setEnabledTools(new Set())
    setPayload((prev: any) => ({
      ...prev,
      arcade: { tools: [], toolkit: [] }
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tools: [], toolkit: [] }))
  }

  // Update the category click handler
  const handleCategoryClick = (cat: string) => {
    setSelectedCategory(cat)
    setSearchQuery(cat) // Set the search query to the category name
    fetchTools(1) // Trigger the search immediately
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 bg-background pt-2 pb-1 z-10">
        {/* <div className="flex items-center space-x-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search toolkits..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => fetchTools(1)}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div> */}

        {!category && (
          <div className="flex items-center justify-between">
            <div className="flex overflow-x-auto pb-2 space-x-2 no-scrollbar">
              {CATEGORIES.map((cat) => (
                <Badge
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleCategoryClick(cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
            {enabledTools.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear Selection ({enabledTools.size})
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {visibleTools.map((tool) => (
          <Card key={tool.id} className="flex items-center justify-between p-4">
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{tool.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{tool.description}</p>
                </div>
                <Switch
                  checked={enabledTools.has(tool.id)}
                  onCheckedChange={(checked) => handleToolToggle(tool.id, checked)}
                  className="ml-4"
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {tool.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Loader element for infinite scroll */}
      {hasMore && (
        <div ref={loaderRef} className="h-4">
          {isLoading && <div className="text-center text-muted-foreground">Loading more tools...</div>}
        </div>
      )}
    </div>
  )
}