"""
Database utility module
Provides database connection management and query operations
"""

import asyncio
import asyncpg
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union
import json

from .logger import get_logger, ContextLogger
from .config_loader import get_config_value

logger = get_logger(__name__)


class DatabaseError(Exception):
    """Custom exception for database-related errors"""
    pass


class ConnectionPoolError(DatabaseError):
    """Exception raised when connection pool operations fail"""
    pass


class QueryError(DatabaseError):
    """Exception raised when query execution fails"""
    pass


class DatabaseManager:
    """
    Async database manager with connection pooling and query utilities
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize database manager with configuration

        Args:
            config: Database configuration dictionary
        """
        self.config = config
        self.pool = None
        self._connected = False
        self._connection_attempts = 0
        self._max_connection_attempts = 3

        # Extract connection parameters
        self.host = config['host']
        self.port = config['port']
        self.database = config['name']
        self.user = config['username']
        self.password = config['password']

        # Pool configuration
        self.min_connections = get_config_value(config, 'pool.min', 5)
        self.max_connections = get_config_value(config, 'pool.max', 20)
        self.command_timeout = get_config_value(config, 'command_timeout', 60)

    async def connect(self) -> None:
        """
        Establish connection pool to the database

        Raises:
            ConnectionPoolError: If connection cannot be established
        """
        if self._connected:
            logger.warning("Database already connected")
            return

        with ContextLogger(logger, "database_connection", host=self.host, database=self.database):
            while self._connection_attempts < self._max_connection_attempts:
                try:
                    self._connection_attempts += 1

                    self.pool = await asyncpg.create_pool(
                        host=self.host,
                        port=self.port,
                        database=self.database,
                        user=self.user,
                        password=self.password,
                        min_size=self.min_connections,
                        max_size=self.max_connections,
                        command_timeout=self.command_timeout,
                        server_settings={
                            'application_name': 'example_app',
                            'timezone': 'UTC'
                        }
                    )

                    self._connected = True
                    logger.info(f"Connected to database: {self.host}:{self.port}/{self.database}")

                    # Test the connection
                    await self.health_check()
                    return

                except Exception as e:
                    logger.error(f"Connection attempt {self._connection_attempts} failed: {e}")

                    if self._connection_attempts >= self._max_connection_attempts:
                        raise ConnectionPoolError(f"Failed to connect after {self._max_connection_attempts} attempts: {e}")

                    # Wait before retrying
                    await asyncio.sleep(2 ** self._connection_attempts)  # Exponential backoff

    async def disconnect(self) -> None:
        """Close the database connection pool"""
        if not self._connected or not self.pool:
            return

        try:
            await self.pool.close()
            self._connected = False
            logger.info("Database connection pool closed")
        except Exception as e:
            logger.error(f"Error closing database connection: {e}")

    async def health_check(self) -> bool:
        """
        Perform a health check on the database connection

        Returns:
            True if database is healthy, False otherwise
        """
        if not self._connected or not self.pool:
            return False

        try:
            async with self.pool.acquire() as connection:
                result = await connection.fetchval("SELECT 1")
                return result == 1
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False

    @asynccontextmanager
    async def get_connection(self):
        """
        Context manager for acquiring a database connection

        Yields:
            Database connection
        """
        if not self._connected or not self.pool:
            raise ConnectionPoolError("Database not connected")

        connection = None
        try:
            connection = await self.pool.acquire()
            yield connection
        except Exception as e:
            logger.error(f"Error with database connection: {e}")
            raise
        finally:
            if connection:
                await self.pool.release(connection)

    async def execute_query(self, query: str, *args, fetch_type: str = 'none') -> Any:
        """
        Execute a database query

        Args:
            query: SQL query string
            *args: Query parameters
            fetch_type: Type of fetch operation ('none', 'one', 'all', 'val')

        Returns:
            Query result based on fetch_type

        Raises:
            QueryError: If query execution fails
        """
        try:
            async with self.get_connection() as connection:
                logger.debug(f"Executing query: {query[:100]}...")

                if fetch_type == 'none':
                    result = await connection.execute(query, *args)
                elif fetch_type == 'one':
                    result = await connection.fetchrow(query, *args)
                elif fetch_type == 'all':
                    result = await connection.fetch(query, *args)
                elif fetch_type == 'val':
                    result = await connection.fetchval(query, *args)
                else:
                    raise QueryError(f"Invalid fetch_type: {fetch_type}")

                logger.debug(f"Query executed successfully, fetch_type: {fetch_type}")
                return result

        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise QueryError(f"Query failed: {e}")

    async def execute_transaction(self, queries: List[Dict[str, Any]]) -> List[Any]:
        """
        Execute multiple queries in a transaction

        Args:
            queries: List of query dictionaries with 'query', 'args', and 'fetch_type' keys

        Returns:
            List of query results

        Raises:
            QueryError: If transaction fails
        """
        results = []

        try:
            async with self.get_connection() as connection:
                async with connection.transaction():
                    for query_info in queries:
                        query = query_info['query']
                        args = query_info.get('args', [])
                        fetch_type = query_info.get('fetch_type', 'none')

                        logger.debug(f"Executing transaction query: {query[:100]}...")

                        if fetch_type == 'none':
                            result = await connection.execute(query, *args)
                        elif fetch_type == 'one':
                            result = await connection.fetchrow(query, *args)
                        elif fetch_type == 'all':
                            result = await connection.fetch(query, *args)
                        elif fetch_type == 'val':
                            result = await connection.fetchval(query, *args)
                        else:
                            raise QueryError(f"Invalid fetch_type: {fetch_type}")

                        results.append(result)

                logger.info(f"Transaction completed successfully with {len(queries)} queries")
                return results

        except Exception as e:
            logger.error(f"Transaction failed: {e}")
            raise QueryError(f"Transaction failed: {e}")

    async def bulk_insert(self, table: str, columns: List[str], data: List[List[Any]]) -> int:
        """
        Perform bulk insert operation

        Args:
            table: Target table name
            columns: List of column names
            data: List of rows to insert

        Returns:
            Number of rows inserted

        Raises:
            QueryError: If bulk insert fails
        """
        if not data:
            return 0

        try:
            async with self.get_connection() as connection:
                column_names = ", ".join(columns)
                placeholders = ", ".join([f"${i+1}" for i in range(len(columns))])
                query = f"INSERT INTO {table} ({column_names}) VALUES ({placeholders})"

                logger.debug(f"Bulk inserting {len(data)} rows into {table}")

                async with connection.transaction():
                    for row in data:
                        await connection.execute(query, *row)

                logger.info(f"Bulk insert completed: {len(data)} rows inserted into {table}")
                return len(data)

        except Exception as e:
            logger.error(f"Bulk insert failed: {e}")
            raise QueryError(f"Bulk insert failed: {e}")

    async def get_table_info(self, table_name: str) -> Dict[str, Any]:
        """
        Get information about a database table

        Args:
            table_name: Name of the table

        Returns:
            Dictionary with table information
        """
        try:
            # Get column information
            columns_query = """
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position
            """
            columns = await self.execute_query(columns_query, table_name, fetch_type='all')

            # Get table size
            size_query = """
                SELECT pg_total_relation_size($1) as total_size,
                       pg_relation_size($1) as table_size,
                       (SELECT count(*) FROM """ + table_name + """) as row_count
            """
            size_info = await self.execute_query(size_query, table_name, fetch_type='one')

            return {
                'table_name': table_name,
                'columns': [dict(col) for col in columns],
                'total_size_bytes': size_info['total_size'],
                'table_size_bytes': size_info['table_size'],
                'row_count': size_info['row_count']
            }

        except Exception as e:
            logger.error(f"Failed to get table info for {table_name}: {e}")
            raise QueryError(f"Failed to get table info: {e}")

    async def create_backup(self, backup_name: str, tables: Optional[List[str]] = None) -> str:
        """
        Create a logical backup of specified tables or entire database

        Args:
            backup_name: Name for the backup
            tables: Optional list of tables to backup (all if None)

        Returns:
            Backup identifier or path

        Raises:
            DatabaseError: If backup creation fails
        """
        try:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_id = f"{backup_name}_{timestamp}"

            logger.info(f"Creating database backup: {backup_id}")

            # This is a simplified backup - in reality, you'd use pg_dump or similar
            backup_data = {
                'backup_id': backup_id,
                'timestamp': timestamp,
                'database': self.database,
                'tables': {}
            }

            if tables is None:
                # Get all table names
                tables_query = """
                    SELECT table_name FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                """
                table_records = await self.execute_query(tables_query, fetch_type='all')
                tables = [record['table_name'] for record in table_records]

            # Backup each table
            for table in tables:
                try:
                    table_data = await self.execute_query(f"SELECT * FROM {table}", fetch_type='all')
                    backup_data['tables'][table] = [dict(row) for row in table_data]
                    logger.debug(f"Backed up table {table}: {len(table_data)} rows")
                except Exception as e:
                    logger.warning(f"Failed to backup table {table}: {e}")

            # In a real implementation, you'd save this to a file or backup service
            logger.info(f"Backup completed: {backup_id}")
            return backup_id

        except Exception as e:
            logger.error(f"Backup creation failed: {e}")
            raise DatabaseError(f"Backup failed: {e}")

    async def execute_migration(self, migration_script: str, migration_id: str) -> bool:
        """
        Execute a database migration script

        Args:
            migration_script: SQL migration script
            migration_id: Unique identifier for the migration

        Returns:
            True if migration was successful

        Raises:
            QueryError: If migration fails
        """
        try:
            logger.info(f"Executing migration: {migration_id}")

            # Check if migration was already applied
            check_query = """
                SELECT EXISTS(
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'migrations'
                )
            """
            migrations_table_exists = await self.execute_query(check_query, fetch_type='val')

            if not migrations_table_exists:
                # Create migrations table
                create_migrations_table = """
                    CREATE TABLE migrations (
                        id SERIAL PRIMARY KEY,
                        migration_id VARCHAR(255) UNIQUE NOT NULL,
                        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        checksum VARCHAR(64)
                    )
                """
                await self.execute_query(create_migrations_table)

            # Check if this migration was already applied
            migration_check = """
                SELECT EXISTS(SELECT 1 FROM migrations WHERE migration_id = $1)
            """
            already_applied = await self.execute_query(migration_check, migration_id, fetch_type='val')

            if already_applied:
                logger.info(f"Migration {migration_id} already applied, skipping")
                return True

            # Execute migration in transaction
            async with self.get_connection() as connection:
                async with connection.transaction():
                    # Execute the migration script
                    await connection.execute(migration_script)

                    # Record the migration
                    record_migration = """
                        INSERT INTO migrations (migration_id) VALUES ($1)
                    """
                    await connection.execute(record_migration, migration_id)

            logger.info(f"Migration {migration_id} completed successfully")
            return True

        except Exception as e:
            logger.error(f"Migration {migration_id} failed: {e}")
            raise QueryError(f"Migration failed: {e}")

    def is_connected(self) -> bool:
        """
        Check if database is connected

        Returns:
            True if connected, False otherwise
        """
        return self._connected and self.pool is not None

    async def get_connection_stats(self) -> Dict[str, Any]:
        """
        Get connection pool statistics

        Returns:
            Dictionary with connection pool stats
        """
        if not self.pool:
            return {'connected': False}

        return {
            'connected': self._connected,
            'pool_size': self.pool.get_size(),
            'pool_min_size': self.pool.get_min_size(),
            'pool_max_size': self.pool.get_max_size(),
            'idle_connections': self.pool.get_idle_size(),
            'connection_attempts': self._connection_attempts
        }


# Helper functions for common database operations
async def ensure_table_exists(db_manager: DatabaseManager, table_name: str, create_sql: str) -> bool:
    """
    Ensure a table exists, create it if it doesn't

    Args:
        db_manager: Database manager instance
        table_name: Name of the table to check
        create_sql: SQL to create the table if it doesn't exist

    Returns:
        True if table exists or was created successfully
    """
    try:
        check_query = """
            SELECT EXISTS(
                SELECT 1 FROM information_schema.tables
                WHERE table_name = $1
            )
        """
        exists = await db_manager.execute_query(check_query, table_name, fetch_type='val')

        if not exists:
            logger.info(f"Creating table {table_name}")
            await db_manager.execute_query(create_sql)
            logger.info(f"Table {table_name} created successfully")

        return True

    except Exception as e:
        logger.error(f"Failed to ensure table {table_name} exists: {e}")
        return False


def build_where_clause(conditions: Dict[str, Any]) -> tuple[str, list]:
    """
    Build WHERE clause from conditions dictionary

    Args:
        conditions: Dictionary of column -> value conditions

    Returns:
        Tuple of (where_clause, parameters)
    """
    if not conditions:
        return "", []

    where_parts = []
    parameters = []
    param_index = 1

    for column, value in conditions.items():
        if isinstance(value, list):
            # IN clause
            placeholders = ", ".join([f"${param_index + i}" for i in range(len(value))])
            where_parts.append(f"{column} IN ({placeholders})")
            parameters.extend(value)
            param_index += len(value)
        elif value is None:
            # IS NULL
            where_parts.append(f"{column} IS NULL")
        else:
            # Equality
            where_parts.append(f"{column} = ${param_index}")
            parameters.append(value)
            param_index += 1

    where_clause = " AND ".join(where_parts)
    return f"WHERE {where_clause}" if where_clause else "", parameters


# Export public API
__all__ = [
    'DatabaseManager',
    'DatabaseError',
    'ConnectionPoolError',
    'QueryError',
    'ensure_table_exists',
    'build_where_clause'
]
