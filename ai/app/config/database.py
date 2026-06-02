import asyncpg
from app.config.config import settings

_DEAD_CONN_ERRORS = (
    asyncpg.exceptions.ConnectionDoesNotExistError,
    asyncpg.exceptions.InterfaceError,
    OSError,
)

class Database:
    def __init__(self):
        self.pool = None

    async def connect(self):
        self.pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL,
            min_size=2,
            max_size=20,
            statement_cache_size=0,
            command_timeout=30,
            max_inactive_connection_lifetime=300,  # đóng connection idle > 5 phút
        )
        print("[DB] Connection pool created")

    async def _ensure_pool(self):
        if not self.pool:
            await self.connect()

    async def _execute_with_retry(self, method: str, query: str, *args):
        """Thử lại 1 lần nếu gặp connection chết."""
        await self._ensure_pool()
        for attempt in range(2):
            try:
                async with self.pool.acquire() as conn:
                    return await getattr(conn, method)(query, *args)
            except _DEAD_CONN_ERRORS as e:
                if attempt == 0:
                    print(f"[DB] ⚠️ Stale connection detected ({e}), recreating pool...")
                    try:
                        await self.pool.close()
                    except Exception:
                        pass
                    self.pool = None
                    await self.connect()
                else:
                    raise

    async def disconnect(self):
        if self.pool:
            await self.pool.close()
            self.pool = None
            print("[DB] Connection pool closed")

    async def fetch(self, query: str, *args):
        return await self._execute_with_retry("fetch", query, *args)

    async def fetchrow(self, query: str, *args):
        return await self._execute_with_retry("fetchrow", query, *args)

    async def execute(self, query: str, *args):
        return await self._execute_with_retry("execute", query, *args)

db = Database()