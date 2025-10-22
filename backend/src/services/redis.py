from redis.asyncio import Redis
from typing import Optional
from src.constants import REDIS_HOST, REDIS_PORT, REDIS_DB, REDIS_PASSWORD
from src.utils.logger import logger

class RedisService:
	_instance: Optional[Redis] = None

	@classmethod
	def get_client(cls) -> Redis:
		if cls._instance is None:
			cls._instance = Redis(
				host=REDIS_HOST,
				port=REDIS_PORT,
				db=REDIS_DB,
				password=REDIS_PASSWORD,
				decode_responses=True,
			)
			logger.info(f"Redis client connected to {REDIS_HOST}:{REDIS_PORT}")
		return cls._instance
	
	async def increment_with_ttl(self, key: str, expire: int = None):
		new_val = await self.get_client().incr(key)
		if expire:
			await self.get_client().expire(key, expire)
		return new_val
	
	
redis_client = RedisService()