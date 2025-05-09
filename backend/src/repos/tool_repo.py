
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from src.tools import tools, attach_tool_details
from src.models.agent import Tool as AgentTool
from src.tools.api import generate_tools_from_openapi_spec

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

	def list_static_tools(self) -> list[AgentTool]:
		tool_names = [attach_tool_details({'id':tool.name, 'description':tool.description, 'args':tool.args, 'tags':tool.tags}) for tool in tools]
		return tool_names

	async def list_user_tools(self) -> list[AgentTool]:
		res = await self.db.execute(select(AgentTool).where(AgentTool.user_id == self.user_id))
		user_tools = res.scalars().all()
		tool_dicts = []
		for tool in user_tools:
			api_tools = generate_tools_from_openapi_spec(openapi_url=tool.url, headers=tool.headers)
			api_tools_with_details = [attach_tool_details({'id':tool.name, 'description':tool.description, 'args':tool.args, 'tags':tool.tags}) for tool in api_tools]
			tool_dicts.extend(api_tools_with_details)
		return tool_dicts
	
	async def create(
		self, 
		name: str, 
		description: str, 
		url: str,
		spec: dict | str = None, 
		headers: dict = None, 
		tags: list[str] = None
	) -> AgentTool:
		try:
			tool = AgentTool(
				name=name, 
				description=description, 
				user_id=self.user_id,
				url=url,
				spec=spec,
				headers=headers,
				tags=tags
			)
			self.db.add(tool)
			await self.db.commit()
			await self.db.refresh(tool)
			return tool
		except IntegrityError as e:
			await self.db.rollback()
			raise ValueError(f"A tool with this name already exists")
		except Exception as e:
			await self.db.rollback()
			raise e

	async def find_by_name(self, name: str) -> AgentTool:
		tool = await self.db.execute(select(AgentTool).where(AgentTool.name == name, AgentTool.user_id == self.user_id))
		return tool.scalar_one_or_none()
	
	async def find_by_id(self, id: str) -> AgentTool:
		tool = await self.db.execute(select(AgentTool).where(AgentTool.id == id, AgentTool.user_id == self.user_id))
		return tool.scalar_one_or_none()

	async def update(
		self, 
		id: str, 
		name: str, 
		description: str, 
		url: str, 
		spec: dict | str = None, 
		headers: dict = None, 
		tags: list[str] = None
	) -> AgentTool:
		tool = await self.find_by_id(id)
		if tool:
			tool.name = name
			tool.description = description
			tool.url = url
			tool.spec = spec
			tool.headers = headers
			tool.tags = tags
			self.db.commit()
			self.db.refresh(tool)
			return tool
		else:
			raise ValueError("Tool not found")

	async def delete(self, id: str) -> None:
		tool = await self.find_by_id(id)
		if tool:
			await self.db.delete(tool)
			await self.db.commit()
		else:
			raise ValueError("Tool not found")