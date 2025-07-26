"""
API client utility module
Provides HTTP client functionality with retry logic, authentication, and error handling
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urljoin, urlparse
import hashlib
import time

from .logger import get_logger, ContextLogger
from .config_loader import get_config_value

logger = get_logger(__name__)


class APIError(Exception):
    """Base exception for API-related errors"""

    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data


class APITimeoutError(APIError):
    """Exception raised when API request times out"""
    pass


class APIAuthenticationError(APIError):
    """Exception raised when API authentication fails"""
    pass


class APIRateLimitError(APIError):
    """Exception raised when API rate limit is exceeded"""
    pass


class APIClient:
    """
    Async HTTP API client with comprehensive error handling and retry logic
    """

    def __init__(self, base_url: str, timeout: int = 30, **kwargs):
        """
        Initialize API client

        Args:
            base_url: Base URL for the API
            timeout: Default timeout for requests
            **kwargs: Additional configuration options
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.session = None

        # Configuration
        self.max_retries = kwargs.get('max_retries', 3)
        self.retry_delay = kwargs.get('retry_delay', 1.0)
        self.retry_backoff = kwargs.get('retry_backoff', 2.0)
        self.max_retry_delay = kwargs.get('max_retry_delay', 60.0)

        # Authentication
        self.auth_token = kwargs.get('auth_token')
        self.api_key = kwargs.get('api_key')
        self.auth_header = kwargs.get('auth_header', 'Authorization')

        # Rate limiting
        self.rate_limit_remaining = None
        self.rate_limit_reset = None
        self.rate_limit_requests = []
        self.rate_limit_window = 60  # 1 minute window

        # Request tracking
        self.request_count = 0
        self.error_count = 0
        self.last_request_time = None

        # Circuit breaker
        self.circuit_breaker_enabled = kwargs.get('circuit_breaker', True)
        self.circuit_breaker_threshold = kwargs.get('circuit_breaker_threshold', 5)
        self.circuit_breaker_timeout = kwargs.get('circuit_breaker_timeout', 300)  # 5 minutes
        self.circuit_breaker_state = 'closed'  # closed, open, half-open
        self.circuit_breaker_failure_count = 0
        self.circuit_breaker_last_failure_time = None

    async def __aenter__(self):
        """Async context manager entry"""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()

    async def initialize(self) -> None:
        """Initialize the HTTP session"""
        if self.session is None:
            connector = aiohttp.TCPConnector(
                limit=100,
                limit_per_host=30,
                ttl_dns_cache=300,
                use_dns_cache=True,
            )

            timeout = aiohttp.ClientTimeout(total=self.timeout)

            self.session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout,
                headers=self._get_default_headers()
            )

            logger.info(f"API client initialized for {self.base_url}")

    async def close(self) -> None:
        """Close the HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None
            logger.info("API client session closed")

    def _get_default_headers(self) -> Dict[str, str]:
        """Get default headers for requests"""
        headers = {
            'User-Agent': 'APIClient/1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }

        # Add authentication headers
        if self.auth_token:
            headers[self.auth_header] = f"Bearer {self.auth_token}"
        elif self.api_key:
            headers['X-API-Key'] = self.api_key

        return headers

    def _check_circuit_breaker(self) -> None:
        """Check circuit breaker state"""
        if not self.circuit_breaker_enabled:
            return

        now = datetime.utcnow()

        if self.circuit_breaker_state == 'open':
            # Check if we should transition to half-open
            if (self.circuit_breaker_last_failure_time and
                now - self.circuit_breaker_last_failure_time > timedelta(seconds=self.circuit_breaker_timeout)):
                self.circuit_breaker_state = 'half-open'
                logger.info("Circuit breaker transitioning to half-open state")
            else:
                raise APIError("Circuit breaker is open - requests blocked")

        elif self.circuit_breaker_state == 'half-open':
            # Allow one request to test if service is back
            pass

    def _update_circuit_breaker(self, success: bool) -> None:
        """Update circuit breaker state based on request result"""
        if not self.circuit_breaker_enabled:
            return

        if success:
            if self.circuit_breaker_state == 'half-open':
                self.circuit_breaker_state = 'closed'
                self.circuit_breaker_failure_count = 0
                logger.info("Circuit breaker closed - service recovered")
        else:
            self.circuit_breaker_failure_count += 1
            self.circuit_breaker_last_failure_time = datetime.utcnow()

            if (self.circuit_breaker_failure_count >= self.circuit_breaker_threshold and
                self.circuit_breaker_state != 'open'):
                self.circuit_breaker_state = 'open'
                logger.warning(f"Circuit breaker opened after {self.circuit_breaker_failure_count} failures")

    def _check_rate_limit(self) -> None:
        """Check if we're hitting rate limits"""
        now = time.time()

        # Clean old requests from the window
        self.rate_limit_requests = [
            req_time for req_time in self.rate_limit_requests
            if now - req_time < self.rate_limit_window
        ]

        # Check server-side rate limit
        if (self.rate_limit_remaining is not None and
            self.rate_limit_remaining <= 0 and
            self.rate_limit_reset and
            now < self.rate_limit_reset):
            wait_time = self.rate_limit_reset - now
            raise APIRateLimitError(f"Rate limit exceeded. Reset in {wait_time:.1f} seconds")

    def _update_rate_limit_info(self, headers: Dict[str, str]) -> None:
        """Update rate limit information from response headers"""
        try:
            if 'X-RateLimit-Remaining' in headers:
                self.rate_limit_remaining = int(headers['X-RateLimit-Remaining'])

            if 'X-RateLimit-Reset' in headers:
                self.rate_limit_reset = int(headers['X-RateLimit-Reset'])

        except (ValueError, TypeError) as e:
            logger.debug(f"Failed to parse rate limit headers: {e}")

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Union[Dict, List]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None
    ) -> aiohttp.ClientResponse:
        """
        Make HTTP request with error handling and retries

        Args:
            method: HTTP method
            endpoint: API endpoint
            data: Request data
            params: URL parameters
            headers: Additional headers
            timeout: Request timeout

        Returns:
            HTTP response

        Raises:
            APIError: If request fails after retries
        """
        if not self.session:
            await self.initialize()

        # Check circuit breaker
        self._check_circuit_breaker()

        # Check rate limiting
        self._check_rate_limit()

        url = urljoin(self.base_url + '/', endpoint.lstrip('/'))
        request_headers = {**self._get_default_headers()}
        if headers:
            request_headers.update(headers)

        # Prepare request data
        json_data = None
        if data is not None:
            if method.upper() in ['POST', 'PUT', 'PATCH']:
                json_data = data
            else:
                params = {**(params or {}), **data} if isinstance(data, dict) else params

        request_timeout = timeout or self.timeout

        for attempt in range(self.max_retries + 1):
            try:
                with ContextLogger(logger, f"{method.upper()} {endpoint}", attempt=attempt + 1):
                    # Track request timing
                    start_time = time.time()
                    self.rate_limit_requests.append(start_time)

                    async with self.session.request(
                        method=method.upper(),
                        url=url,
                        json=json_data,
                        params=params,
                        headers=request_headers,
                        timeout=aiohttp.ClientTimeout(total=request_timeout)
                    ) as response:

                        # Update metrics
                        self.request_count += 1
                        self.last_request_time = datetime.utcnow()

                        # Update rate limit info
                        self._update_rate_limit_info(dict(response.headers))

                        # Handle different status codes
                        if response.status == 429:  # Rate limited
                            retry_after = response.headers.get('Retry-After', '60')
                            try:
                                wait_time = int(retry_after)
                            except ValueError:
                                wait_time = 60

                            if attempt < self.max_retries:
                                logger.warning(f"Rate limited, waiting {wait_time} seconds before retry")
                                await asyncio.sleep(wait_time)
                                continue
                            else:
                                raise APIRateLimitError(f"Rate limit exceeded: {response.status}")

                        elif response.status == 401:
                            raise APIAuthenticationError(f"Authentication failed: {response.status}")

                        elif 400 <= response.status < 500:
                            # Client error - don't retry
                            response_text = await response.text()
                            self._update_circuit_breaker(False)
                            raise APIError(
                                f"Client error: {response.status} - {response_text}",
                                status_code=response.status,
                                response_data={'text': response_text}
                            )

                        elif response.status >= 500:
                            # Server error - retry
                            if attempt < self.max_retries:
                                delay = min(
                                    self.retry_delay * (self.retry_backoff ** attempt),
                                    self.max_retry_delay
                                )
                                logger.warning(f"Server error {response.status}, retrying in {delay:.1f}s")
                                await asyncio.sleep(delay)
                                continue
                            else:
                                response_text = await response.text()
                                self._update_circuit_breaker(False)
                                raise APIError(
                                    f"Server error: {response.status} - {response_text}",
                                    status_code=response.status,
                                    response_data={'text': response_text}
                                )

                        # Success
                        self._update_circuit_breaker(True)
                        return response

            except asyncio.TimeoutError:
                if attempt < self.max_retries:
                    delay = min(
                        self.retry_delay * (self.retry_backoff ** attempt),
                        self.max_retry_delay
                    )
                    logger.warning(f"Request timeout, retrying in {delay:.1f}s")
                    await asyncio.sleep(delay)
                    continue
                else:
                    self.error_count += 1
                    self._update_circuit_breaker(False)
                    raise APITimeoutError(f"Request timeout after {self.max_retries} retries")

            except Exception as e:
                if attempt < self.max_retries:
                    delay = min(
                        self.retry_delay * (self.retry_backoff ** attempt),
                        self.max_retry_delay
                    )
                    logger.warning(f"Request failed with {type(e).__name__}: {e}, retrying in {delay:.1f}s")
                    await asyncio.sleep(delay)
                    continue
                else:
                    self.error_count += 1
                    self._update_circuit_breaker(False)
                    raise APIError(f"Request failed after {self.max_retries} retries: {e}")

    async def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None, **kwargs) -> Dict[str, Any]:
        """Make GET request"""
        response = await self._make_request('GET', endpoint, params=params, **kwargs)
        return await self._parse_response(response)

    async def post(self, endpoint: str, data: Optional[Union[Dict, List]] = None, **kwargs) -> Dict[str, Any]:
        """Make POST request"""
        response = await self._make_request('POST', endpoint, data=data, **kwargs)
        return await self._parse_response(response)

    async def put(self, endpoint: str, data: Optional[Union[Dict, List]] = None, **kwargs) -> Dict[str, Any]:
        """Make PUT request"""
        response = await self._make_request('PUT', endpoint, data=data, **kwargs)
        return await self._parse_response(response)

    async def patch(self, endpoint: str, data: Optional[Union[Dict, List]] = None, **kwargs) -> Dict[str, Any]:
        """Make PATCH request"""
        response = await self._make_request('PATCH', endpoint, data=data, **kwargs)
        return await self._parse_response(response)

    async def delete(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make DELETE request"""
        response = await self._make_request('DELETE', endpoint, **kwargs)
        return await self._parse_response(response)

    async def _parse_response(self, response: aiohttp.ClientResponse) -> Dict[str, Any]:
        """Parse response data"""
        try:
            if response.content_type.startswith('application/json'):
                return await response.json()
            else:
                text = await response.text()
                return {'data': text, 'content_type': response.content_type}
        except Exception as e:
            logger.error(f"Failed to parse response: {e}")
            return {'error': f"Failed to parse response: {e}"}

    async def health_check(self) -> bool:
        """
        Perform health check on the API

        Returns:
            True if API is healthy, False otherwise
        """
        try:
            # Try a simple GET request to a health endpoint or root
            health_endpoints = ['/health', '/ping', '/status', '/']

            for endpoint in health_endpoints:
                try:
                    response = await self._make_request('GET', endpoint, timeout=10)
                    if response.status < 400:
                        logger.debug(f"Health check passed via {endpoint}")
                        return True
                except APIError:
                    continue

            return False

        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False

    async def sync_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Sync user data with external API

        Args:
            user_id: User ID to sync

        Returns:
            Updated user data or None if sync failed
        """
        try:
            endpoint = f"/users/{user_id}/sync"
            return await self.post(endpoint, data={'action': 'sync'})
        except Exception as e:
            logger.error(f"User sync failed for {user_id}: {e}")
            return None

    def get_stats(self) -> Dict[str, Any]:
        """
        Get client statistics

        Returns:
            Dictionary with client stats
        """
        return {
            'base_url': self.base_url,
            'request_count': self.request_count,
            'error_count': self.error_count,
            'error_rate': self.error_count / max(self.request_count, 1),
            'last_request_time': self.last_request_time.isoformat() if self.last_request_time else None,
            'circuit_breaker_state': self.circuit_breaker_state,
            'circuit_breaker_failure_count': self.circuit_breaker_failure_count,
            'rate_limit_remaining': self.rate_limit_remaining,
            'rate_limit_reset': self.rate_limit_reset,
            'session_active': self.session is not None
        }

    def reset_stats(self) -> None:
        """Reset client statistics"""
        self.request_count = 0
        self.error_count = 0
        self.last_request_time = None
        self.circuit_breaker_failure_count = 0
        self.circuit_breaker_last_failure_time = None
        self.circuit_breaker_state = 'closed'


# Helper functions
def create_api_client(config: Dict[str, Any]) -> APIClient:
    """
    Create API client from configuration

    Args:
        config: API configuration dictionary

    Returns:
        Configured API client
    """
    base_url = config['base_url']
    timeout = get_config_value(config, 'timeout', 30)

    client_config = {
        'max_retries': get_config_value(config, 'max_retries', 3),
        'retry_delay': get_config_value(config, 'retry_delay', 1.0),
        'circuit_breaker': get_config_value(config, 'circuit_breaker', True),
        'auth_token': get_config_value(config, 'auth_token'),
        'api_key': get_config_value(config, 'api_key')
    }

    return APIClient(base_url, timeout, **client_config)


# Export public API
__all__ = [
    'APIClient',
    'APIError',
    'APITimeoutError',
    'APIAuthenticationError',
    'APIRateLimitError',
    'create_api_client'
]
