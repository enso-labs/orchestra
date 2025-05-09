
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from src.tools import tools, attach_tool_details

class AgentTool(BaseModel):
	name: str
	description: str
	args: dict
	tags: list[str]

class ToolRepo:
	_instance = None
	
	def __new__(cls, db: AsyncSession, user_id: str = None):
		if cls._instance is None:
			cls._instance = super(ToolRepo, cls).__new__(cls)
			cls._instance.db = None
			cls._instance.user_id = None
		return cls._instance
	
	def __init__(self, db: AsyncSession, user_id: str = None):
		# Update attributes if they've changed
		self.db = db
		self.user_id = user_id

	async def list_static_tools(self) -> list[AgentTool]:
		tool_names = [attach_tool_details({'id':tool.name, 'description':tool.description, 'args':tool.args, 'tags':tool.tags}) for tool in tools]
		return tool_names
	
	def create(
     	self, 
		name: str, 
		description: str, 
		args: dict, 
		tags: list[str]
    ) -> AgentTool:
		try:
			tool = AgentTool(name=name, description=description, args=args, tags=tags, user_id=self.user_id)
			self.db.add(tool)
			self.db.commit()
			self.db.refresh(tool)
			return tool
		except Exception as e:
			raise e