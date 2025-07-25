"""
Configuration loader and validator module
Handles loading configuration from various file formats and validating the structure
"""

import json
import os
import yaml
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from .logger import get_logger

logger = get_logger(__name__)


class ConfigurationError(Exception):
    """Custom exception for configuration-related errors"""
    pass


class ConfigLoader:
    """Configuration loader with support for multiple file formats"""

    SUPPORTED_FORMATS = {'.yaml', '.yml', '.json'}

    def __init__(self, search_paths: Optional[List[str]] = None):
        """
        Initialize the config loader

        Args:
            search_paths: List of paths to search for config files
        """
        self.search_paths = search_paths or [
            '.',
            './config',
            os.path.expanduser('~/.config/app'),
            '/etc/app'
        ]

    def load(self, config_path: str) -> Dict[str, Any]:
        """
        Load configuration from file

        Args:
            config_path: Path to configuration file

        Returns:
            Configuration dictionary

        Raises:
            ConfigurationError: If file cannot be loaded or parsed
        """
        # Resolve the config file path
        resolved_path = self._resolve_config_path(config_path)

        if not resolved_path.exists():
            raise ConfigurationError(f"Configuration file not found: {config_path}")

        logger.info(f"Loading configuration from: {resolved_path}")

        try:
            with open(resolved_path, 'r') as file:
                if resolved_path.suffix.lower() in {'.yaml', '.yml'}:
                    config = yaml.safe_load(file)
                elif resolved_path.suffix.lower() == '.json':
                    config = json.load(file)
                else:
                    raise ConfigurationError(f"Unsupported file format: {resolved_path.suffix}")

            # Apply environment variable substitution
            config = self._substitute_env_vars(config)

            logger.info("Configuration loaded successfully")
            return config

        except yaml.YAMLError as e:
            raise ConfigurationError(f"YAML parsing error: {e}")
        except json.JSONDecodeError as e:
            raise ConfigurationError(f"JSON parsing error: {e}")
        except Exception as e:
            raise ConfigurationError(f"Error loading configuration: {e}")

    def _resolve_config_path(self, config_path: str) -> Path:
        """
        Resolve configuration file path by searching in predefined locations

        Args:
            config_path: Configuration file path or name

        Returns:
            Resolved Path object
        """
        path = Path(config_path)

        # If absolute path or exists in current directory, return as-is
        if path.is_absolute() or path.exists():
            return path

        # Search in predefined paths
        for search_path in self.search_paths:
            candidate = Path(search_path) / config_path
            if candidate.exists():
                return candidate

        # Return original path (will fail later if not found)
        return path

    def _substitute_env_vars(self, config: Any) -> Any:
        """
        Recursively substitute environment variables in configuration

        Args:
            config: Configuration value (dict, list, or primitive)

        Returns:
            Configuration with environment variables substituted
        """
        if isinstance(config, dict):
            return {key: self._substitute_env_vars(value) for key, value in config.items()}
        elif isinstance(config, list):
            return [self._substitute_env_vars(item) for item in config]
        elif isinstance(config, str):
            return self._substitute_env_var_string(config)
        else:
            return config

    def _substitute_env_var_string(self, value: str) -> str:
        """
        Substitute environment variables in a string

        Args:
            value: String that may contain environment variable references

        Returns:
            String with environment variables substituted
        """
        # Simple substitution for ${VAR} and ${VAR:default} patterns
        import re

        def replace_env_var(match):
            var_expr = match.group(1)
            if ':' in var_expr:
                var_name, default_value = var_expr.split(':', 1)
                return os.getenv(var_name, default_value)
            else:
                return os.getenv(var_expr, match.group(0))

        # Replace ${VAR} and ${VAR:default} patterns
        pattern = r'\$\{([^}]+)\}'
        return re.sub(pattern, replace_env_var, value)


class ConfigValidator:
    """Configuration validator with schema support"""

    def __init__(self, schema: Optional[Dict] = None):
        """
        Initialize the validator

        Args:
            schema: Validation schema dictionary
        """
        self.schema = schema or self._get_default_schema()

    def validate(self, config: Dict[str, Any]) -> bool:
        """
        Validate configuration against schema

        Args:
            config: Configuration dictionary to validate

        Returns:
            True if valid

        Raises:
            ConfigurationError: If validation fails
        """
        logger.debug("Validating configuration...")

        errors = []
        self._validate_recursive(config, self.schema, '', errors)

        if errors:
            error_message = "Configuration validation failed:\n" + "\n".join(errors)
            raise ConfigurationError(error_message)

        logger.info("Configuration validation passed")
        return True

    def _validate_recursive(self, config: Any, schema: Any, path: str, errors: List[str]) -> None:
        """
        Recursively validate configuration against schema

        Args:
            config: Configuration value to validate
            schema: Schema to validate against
            path: Current path in the configuration (for error messages)
            errors: List to collect validation errors
        """
        if isinstance(schema, dict):
            if 'type' in schema:
                # Validate type
                expected_type = schema['type']
                if not self._check_type(config, expected_type):
                    errors.append(f"{path}: expected {expected_type}, got {type(config).__name__}")
                    return

            if 'required' in schema and schema['required']:
                if config is None:
                    errors.append(f"{path}: required field is missing")
                    return

            if 'properties' in schema and isinstance(config, dict):
                # Validate object properties
                for prop_name, prop_schema in schema['properties'].items():
                    prop_path = f"{path}.{prop_name}" if path else prop_name
                    prop_value = config.get(prop_name)
                    self._validate_recursive(prop_value, prop_schema, prop_path, errors)

            if 'items' in schema and isinstance(config, list):
                # Validate array items
                for i, item in enumerate(config):
                    item_path = f"{path}[{i}]"
                    self._validate_recursive(item, schema['items'], item_path, errors)

            # Validate constraints
            if 'min' in schema and isinstance(config, (int, float)):
                if config < schema['min']:
                    errors.append(f"{path}: value {config} is less than minimum {schema['min']}")

            if 'max' in schema and isinstance(config, (int, float)):
                if config > schema['max']:
                    errors.append(f"{path}: value {config} is greater than maximum {schema['max']}")

            if 'pattern' in schema and isinstance(config, str):
                import re
                if not re.match(schema['pattern'], config):
                    errors.append(f"{path}: value '{config}' does not match pattern '{schema['pattern']}'")

    def _check_type(self, value: Any, expected_type: str) -> bool:
        """
        Check if value matches expected type

        Args:
            value: Value to check
            expected_type: Expected type name

        Returns:
            True if type matches
        """
        type_mapping = {
            'string': str,
            'integer': int,
            'number': (int, float),
            'boolean': bool,
            'array': list,
            'object': dict,
            'null': type(None)
        }

        expected_python_type = type_mapping.get(expected_type)
        if expected_python_type is None:
            return True  # Unknown type, assume valid

        return isinstance(value, expected_python_type)

    def _get_default_schema(self) -> Dict:
        """
        Get default configuration schema

        Returns:
            Default schema dictionary
        """
        return {
            'type': 'object',
            'properties': {
                'database': {
                    'type': 'object',
                    'required': True,
                    'properties': {
                        'host': {'type': 'string', 'required': True},
                        'port': {'type': 'integer', 'required': True, 'min': 1, 'max': 65535},
                        'name': {'type': 'string', 'required': True},
                        'username': {'type': 'string', 'required': True},
                        'password': {'type': 'string', 'required': True}
                    }
                },
                'api': {
                    'type': 'object',
                    'required': True,
                    'properties': {
                        'base_url': {'type': 'string', 'required': True, 'pattern': r'^https?://'},
                        'timeout': {'type': 'integer', 'min': 1}
                    }
                },
                'logging': {
                    'type': 'object',
                    'properties': {
                        'level': {
                            'type': 'string',
                            'pattern': r'^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$'
                        },
                        'enable_colors': {'type': 'boolean'},
                        'enable_file_logging': {'type': 'boolean'}
                    }
                }
            }
        }


# Global instances
_config_loader = ConfigLoader()
_config_validator = ConfigValidator()


def load_config(config_path: str, search_paths: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Load configuration from file

    Args:
        config_path: Path to configuration file
        search_paths: Optional list of paths to search for config file

    Returns:
        Configuration dictionary
    """
    if search_paths:
        loader = ConfigLoader(search_paths)
    else:
        loader = _config_loader

    return loader.load(config_path)


def validate_config(config: Dict[str, Any], schema: Optional[Dict] = None) -> bool:
    """
    Validate configuration against schema

    Args:
        config: Configuration dictionary to validate
        schema: Optional validation schema

    Returns:
        True if valid
    """
    if schema:
        validator = ConfigValidator(schema)
    else:
        validator = _config_validator

    return validator.validate(config)


def get_config_value(config: Dict[str, Any], path: str, default: Any = None) -> Any:
    """
    Get a nested configuration value using dot notation

    Args:
        config: Configuration dictionary
        path: Dot-separated path to the value (e.g., 'database.host')
        default: Default value if path not found

    Returns:
        Configuration value or default
    """
    keys = path.split('.')
    value = config

    try:
        for key in keys:
            value = value[key]
        return value
    except (KeyError, TypeError):
        return default


def merge_configs(*configs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merge multiple configuration dictionaries

    Args:
        configs: Configuration dictionaries to merge

    Returns:
        Merged configuration dictionary
    """
    result = {}

    for config in configs:
        result = _deep_merge(result, config)

    return result


def _deep_merge(dict1: Dict[str, Any], dict2: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deep merge two dictionaries

    Args:
        dict1: First dictionary
        dict2: Second dictionary (takes precedence)

    Returns:
        Merged dictionary
    """
    result = dict1.copy()

    for key, value in dict2.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value

    return result


# Export public API
__all__ = [
    'ConfigLoader',
    'ConfigValidator',
    'ConfigurationError',
    'load_config',
    'validate_config',
    'get_config_value',
    'merge_configs'
]
