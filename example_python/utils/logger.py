"""
Logging utility module
Provides centralized logging configuration and logger instances
"""

import logging
import logging.handlers
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Union
import json
import os


class ColoredFormatter(logging.Formatter):
    """Custom formatter that adds colors to log levels"""

    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Green
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',    # Red
        'CRITICAL': '\033[35m', # Magenta
        'RESET': '\033[0m'      # Reset
    }

    def format(self, record):
        # Add color to the level name
        if record.levelname in self.COLORS:
            record.levelname = f"{self.COLORS[record.levelname]}{record.levelname}{self.COLORS['RESET']}"

        return super().format(record)


class JsonFormatter(logging.Formatter):
    """Formatter that outputs log records as JSON"""

    def format(self, record):
        log_entry = {
            'timestamp': datetime.fromtimestamp(record.created).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)

        # Add extra fields if present
        if hasattr(record, 'extra_data'):
            log_entry.update(record.extra_data)

        return json.dumps(log_entry)


def setup_logging(config: Optional[Dict] = None) -> None:
    """
    Setup logging configuration for the application

    Args:
        config: Logging configuration dictionary
    """
    if config is None:
        config = {}

    # Default configuration
    default_config = {
        'level': 'INFO',
        'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        'date_format': '%Y-%m-%d %H:%M:%S',
        'enable_colors': True,
        'enable_file_logging': False,
        'log_file': 'application.log',
        'max_file_size': 10 * 1024 * 1024,  # 10MB
        'backup_count': 5,
        'json_format': False
    }

    # Merge with provided config
    final_config = {**default_config, **config}

    # Set root logger level
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, final_config['level'].upper()))

    # Clear existing handlers
    root_logger.handlers.clear()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)

    if final_config['json_format']:
        console_formatter = JsonFormatter()
    elif final_config['enable_colors'] and sys.stdout.isatty():
        console_formatter = ColoredFormatter(
            fmt=final_config['format'],
            datefmt=final_config['date_format']
        )
    else:
        console_formatter = logging.Formatter(
            fmt=final_config['format'],
            datefmt=final_config['date_format']
        )

    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)

    # File handler (if enabled)
    if final_config['enable_file_logging']:
        log_file_path = Path(final_config['log_file'])
        log_file_path.parent.mkdir(parents=True, exist_ok=True)

        file_handler = logging.handlers.RotatingFileHandler(
            filename=log_file_path,
            maxBytes=final_config['max_file_size'],
            backupCount=final_config['backup_count']
        )

        if final_config['json_format']:
            file_formatter = JsonFormatter()
        else:
            file_formatter = logging.Formatter(
                fmt=final_config['format'],
                datefmt=final_config['date_format']
            )

        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)

    # Log the configuration
    logger = get_logger(__name__)
    logger.info(f"Logging configured with level: {final_config['level']}")


def get_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """
    Get a logger instance for the specified name

    Args:
        name: Logger name (usually __name__)
        level: Optional logging level override

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)

    if level:
        logger.setLevel(getattr(logging, level.upper()))

    return logger


class LoggerAdapter(logging.LoggerAdapter):
    """
    Custom logger adapter that adds extra context to log records
    """

    def __init__(self, logger: logging.Logger, extra_data: Dict):
        super().__init__(logger, extra_data)

    def process(self, msg, kwargs):
        # Add extra data to the log record
        if 'extra' not in kwargs:
            kwargs['extra'] = {}

        kwargs['extra']['extra_data'] = self.extra
        return msg, kwargs


def get_logger_with_context(name: str, context: Dict) -> LoggerAdapter:
    """
    Get a logger with additional context information

    Args:
        name: Logger name
        context: Additional context to include in log messages

    Returns:
        Logger adapter with context
    """
    base_logger = get_logger(name)
    return LoggerAdapter(base_logger, context)


def log_function_call(func):
    """
    Decorator to log function calls with arguments and return values
    """
    def wrapper(*args, **kwargs):
        logger = get_logger(func.__module__)

        # Log function entry
        logger.debug(f"Calling {func.__name__} with args={args}, kwargs={kwargs}")

        try:
            result = func(*args, **kwargs)
            logger.debug(f"{func.__name__} returned: {result}")
            return result
        except Exception as e:
            logger.error(f"{func.__name__} raised exception: {e}")
            raise

    return wrapper


def log_execution_time(func):
    """
    Decorator to log function execution time
    """
    def wrapper(*args, **kwargs):
        logger = get_logger(func.__module__)
        start_time = datetime.now()

        try:
            result = func(*args, **kwargs)
            execution_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"{func.__name__} executed in {execution_time:.3f} seconds")
            return result
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            logger.error(f"{func.__name__} failed after {execution_time:.3f} seconds: {e}")
            raise

    return wrapper


class ContextLogger:
    """
    Context manager for logging with additional context
    """

    def __init__(self, logger: Union[logging.Logger, str], operation: str, **context):
        if isinstance(logger, str):
            self.logger = get_logger(logger)
        else:
            self.logger = logger

        self.operation = operation
        self.context = context
        self.start_time = None

    def __enter__(self):
        self.start_time = datetime.now()
        self.logger.info(f"Starting {self.operation}", extra={'context': self.context})
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        execution_time = (datetime.now() - self.start_time).total_seconds()

        if exc_type is None:
            self.logger.info(
                f"Completed {self.operation} in {execution_time:.3f}s",
                extra={'context': self.context}
            )
        else:
            self.logger.error(
                f"Failed {self.operation} after {execution_time:.3f}s: {exc_val}",
                extra={'context': self.context}
            )

        return False  # Don't suppress exceptions


# Initialize default logging if not already configured
if not logging.getLogger().handlers:
    setup_logging({
        'level': os.getenv('LOG_LEVEL', 'INFO'),
        'enable_colors': os.getenv('LOG_COLORS', 'true').lower() == 'true',
        'enable_file_logging': os.getenv('LOG_TO_FILE', 'false').lower() == 'true'
    })


# Export commonly used functions
__all__ = [
    'setup_logging',
    'get_logger',
    'get_logger_with_context',
    'log_function_call',
    'log_execution_time',
    'ContextLogger',
    'ColoredFormatter',
    'JsonFormatter'
]
