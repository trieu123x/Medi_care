import hashlib
import time
from typing import Optional, Dict, Any

class SimpleCacheService:
    """
    Cache đơn giản trong memory để lưu kết quả classification/rewrite.
    TTL: 1 giờ
    """
    def __init__(self, ttl_seconds: int = 3600):
        self.cache: Dict[str, tuple[Any, float]] = {}
        self.ttl_seconds = ttl_seconds
    
    def _get_key(self, *args) -> str:
        """Tạo cache key từ arguments"""
        content = "|".join(str(arg) for arg in args)
        return hashlib.md5(content.encode()).hexdigest()
    
    def get(self, *args) -> Optional[Any]:
        """Lấy giá trị từ cache nếu còn hạn"""
        key = self._get_key(*args)
        if key in self.cache:
            value, timestamp = self.cache[key]
            if time.time() - timestamp < self.ttl_seconds:
                return value
            else:
                del self.cache[key]  # Xóa cache hết hạn
        return None
    
    def set(self, value: Any, *args):
        """Lưu giá trị vào cache"""
        key = self._get_key(*args)
        self.cache[key] = (value, time.time())
    
    def clear(self):
        """Xóa toàn bộ cache"""
        self.cache.clear()
    
    def size(self) -> int:
        """Lấy số lượng items trong cache"""
        return len(self.cache)


class RateLimiter:
    """
    Rate limiter đơn giản: cho phép tối đa N requests trong T giây
    """
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.request_times: Dict[str, list[float]] = {}
    
    def is_allowed(self, user_id: str = "default") -> bool:
        """Kiểm tra xem request có được phép không"""
        now = time.time()
        
        if user_id not in self.request_times:
            self.request_times[user_id] = []
        
        # Xóa các request cũ ngoài window
        self.request_times[user_id] = [
            t for t in self.request_times[user_id]
            if now - t < self.window_seconds
        ]
        
        # Kiểm tra xem vượt quá limit chưa
        if len(self.request_times[user_id]) < self.max_requests:
            self.request_times[user_id].append(now)
            return True
        
        return False
    
    def get_remaining(self, user_id: str = "default") -> int:
        """Lấy số requests còn lại"""
        now = time.time()
        
        if user_id not in self.request_times:
            return self.max_requests
        
        # Xóa các request cũ
        self.request_times[user_id] = [
            t for t in self.request_times[user_id]
            if now - t < self.window_seconds
        ]
        
        return max(0, self.max_requests - len(self.request_times[user_id]))


# Global instances
cache_service = SimpleCacheService(ttl_seconds=3600)
rate_limiter = RateLimiter(max_requests=30, window_seconds=60)
