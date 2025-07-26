"""
Data validation utility module
Provides comprehensive validation functions for different data types and structures
"""

import re
import email_validator
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Union, Callable
from urllib.parse import urlparse
import json

from .logger import get_logger

logger = get_logger(__name__)


class ValidationError(Exception):
    """Custom exception for validation errors"""

    def __init__(self, message: str, field: Optional[str] = None, value: Any = None):
        super().__init__(message)
        self.field = field
        self.value = value
        self.message = message


class SchemaValidationError(ValidationError):
    """Exception raised when schema validation fails"""
    pass


class DataValidator:
    """
    Comprehensive data validator with support for various data types and schemas
    """

    def __init__(self, strict_mode: bool = False):
        """
        Initialize the validator

        Args:
            strict_mode: If True, validation will be more restrictive
        """
        self.strict_mode = strict_mode
        self.validation_errors = []

        # Common regex patterns
        self.patterns = {
            'email': re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'),
            'phone': re.compile(r'^\+?[\d\s\-\(\)]+$'),
            'url': re.compile(r'^https?://[^\s<>"{}|\\^`\[\]]+$'),
            'ipv4': re.compile(r'^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$'),
            'uuid': re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', re.IGNORECASE),
            'alphanumeric': re.compile(r'^[a-zA-Z0-9]+$'),
            'alpha': re.compile(r'^[a-zA-Z]+$'),
            'numeric': re.compile(r'^[0-9]+$'),
            'slug': re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$'),
            'credit_card': re.compile(r'^[0-9]{13,19}$'),
            'postal_code': re.compile(r'^[0-9]{5}(?:-[0-9]{4})?$'),
            'hex_color': re.compile(r'^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$')
        }

    def validate_string(self, value: Any, min_length: int = 0, max_length: Optional[int] = None,
                       pattern: Optional[str] = None, allowed_values: Optional[List[str]] = None) -> str:
        """
        Validate string value

        Args:
            value: Value to validate
            min_length: Minimum string length
            max_length: Maximum string length
            pattern: Regex pattern to match
            allowed_values: List of allowed string values

        Returns:
            Validated string

        Raises:
            ValidationError: If validation fails
        """
        if value is None:
            raise ValidationError("String value cannot be None")

        if not isinstance(value, str):
            if self.strict_mode:
                raise ValidationError(f"Expected string, got {type(value).__name__}")
            else:
                value = str(value)

        # Check length constraints
        if len(value) < min_length:
            raise ValidationError(f"String must be at least {min_length} characters long")

        if max_length is not None and len(value) > max_length:
            raise ValidationError(f"String must be at most {max_length} characters long")

        # Check pattern
        if pattern and not re.match(pattern, value):
            raise ValidationError(f"String does not match required pattern: {pattern}")

        # Check allowed values
        if allowed_values and value not in allowed_values:
            raise ValidationError(f"String must be one of: {', '.join(allowed_values)}")

        return value.strip() if not self.strict_mode else value

    def validate_integer(self, value: Any, min_value: Optional[int] = None,
                        max_value: Optional[int] = None) -> int:
        """
        Validate integer value

        Args:
            value: Value to validate
            min_value: Minimum allowed value
            max_value: Maximum allowed value

        Returns:
            Validated integer

        Raises:
            ValidationError: If validation fails
        """
        if value is None:
            raise ValidationError("Integer value cannot be None")

        # Try to convert to int
        try:
            if isinstance(value, str):
                value = int(value)
            elif isinstance(value, float):
                if value.is_integer():
                    value = int(value)
                else:
                    raise ValidationError("Float value is not a whole number")
            elif not isinstance(value, int):
                raise ValidationError(f"Cannot convert {type(value).__name__} to integer")
        except ValueError:
            raise ValidationError(f"Invalid integer value: {value}")

        # Check range constraints
        if min_value is not None and value < min_value:
            raise ValidationError(f"Integer must be at least {min_value}")

        if max_value is not None and value > max_value:
            raise ValidationError(f"Integer must be at most {max_value}")

        return value

    def validate_float(self, value: Any, min_value: Optional[float] = None,
                      max_value: Optional[float] = None, precision: Optional[int] = None) -> float:
        """
        Validate float value

        Args:
            value: Value to validate
            min_value: Minimum allowed value
            max_value: Maximum allowed value
            precision: Number of decimal places to round to

        Returns:
            Validated float

        Raises:
            ValidationError: If validation fails
        """
        if value is None:
            raise ValidationError("Float value cannot be None")

        # Try to convert to float
        try:
            if isinstance(value, str):
                value = float(value)
            elif not isinstance(value, (int, float)):
                raise ValidationError(f"Cannot convert {type(value).__name__} to float")
            else:
                value = float(value)
        except ValueError:
            raise ValidationError(f"Invalid float value: {value}")

        # Check range constraints
        if min_value is not None and value < min_value:
            raise ValidationError(f"Float must be at least {min_value}")

        if max_value is not None and value > max_value:
            raise ValidationError(f"Float must be at most {max_value}")

        # Apply precision
        if precision is not None:
            value = round(value, precision)

        return value

    def validate_boolean(self, value: Any) -> bool:
        """
        Validate boolean value

        Args:
            value: Value to validate

        Returns:
            Validated boolean

        Raises:
            ValidationError: If validation fails
        """
        if value is None:
            raise ValidationError("Boolean value cannot be None")

        if isinstance(value, bool):
            return value

        if isinstance(value, str):
            lower_value = value.lower()
            if lower_value in ('true', '1', 'yes', 'on'):
                return True
            elif lower_value in ('false', '0', 'no', 'off'):
                return False
            else:
                raise ValidationError(f"Cannot convert string '{value}' to boolean")

        if isinstance(value, (int, float)):
            return bool(value)

        if self.strict_mode:
            raise ValidationError(f"Expected boolean, got {type(value).__name__}")

        return bool(value)

    def validate_email(self, value: Any) -> str:
        """
        Validate email address

        Args:
            value: Email address to validate

        Returns:
            Validated email address

        Raises:
            ValidationError: If email is invalid
        """
        if not isinstance(value, str):
            raise ValidationError("Email must be a string")

        email = value.strip().lower()

        # Basic regex check
        if not self.patterns['email'].match(email):
            raise ValidationError("Invalid email format")

        # More thorough validation using email-validator library
        try:
            # This would require the email-validator package in a real implementation
            # For now, we'll stick with regex validation
            pass
        except Exception:
            raise ValidationError("Invalid email address")

        return email

    def validate_url(self, value: Any, schemes: Optional[List[str]] = None) -> str:
        """
        Validate URL

        Args:
            value: URL to validate
            schemes: Allowed URL schemes (default: ['http', 'https'])

        Returns:
            Validated URL

        Raises:
            ValidationError: If URL is invalid
        """
        if not isinstance(value, str):
            raise ValidationError("URL must be a string")

        url = value.strip()

        if not url:
            raise ValidationError("URL cannot be empty")

        # Parse URL
        try:
            parsed = urlparse(url)
        except Exception:
            raise ValidationError("Invalid URL format")

        # Check scheme
        if schemes is None:
            schemes = ['http', 'https']

        if parsed.scheme not in schemes:
            raise ValidationError(f"URL scheme must be one of: {', '.join(schemes)}")

        # Check if netloc exists
        if not parsed.netloc:
            raise ValidationError("URL must have a valid domain")

        return url

    def validate_date(self, value: Any, date_format: str = '%Y-%m-%d') -> date:
        """
        Validate date value

        Args:
            value: Date value to validate
            date_format: Expected date format string

        Returns:
            Validated date object

        Raises:
            ValidationError: If date is invalid
        """
        if isinstance(value, date):
            return value

        if isinstance(value, datetime):
            return value.date()

        if isinstance(value, str):
            try:
                parsed_date = datetime.strptime(value, date_format)
                return parsed_date.date()
            except ValueError:
                raise ValidationError(f"Invalid date format. Expected: {date_format}")

        raise ValidationError(f"Cannot convert {type(value).__name__} to date")

    def validate_datetime(self, value: Any, datetime_format: str = '%Y-%m-%d %H:%M:%S') -> datetime:
        """
        Validate datetime value

        Args:
            value: Datetime value to validate
            datetime_format: Expected datetime format string

        Returns:
            Validated datetime object

        Raises:
            ValidationError: If datetime is invalid
        """
        if isinstance(value, datetime):
            return value

        if isinstance(value, str):
            try:
                return datetime.strptime(value, datetime_format)
            except ValueError:
                # Try ISO format as fallback
                try:
                    return datetime.fromisoformat(value.replace('Z', '+00:00'))
                except ValueError:
                    raise ValidationError(f"Invalid datetime format. Expected: {datetime_format}")

        raise ValidationError(f"Cannot convert {type(value).__name__} to datetime")

    def validate_list(self, value: Any, item_validator: Optional[Callable] = None,
                     min_length: int = 0, max_length: Optional[int] = None) -> List[Any]:
        """
        Validate list value

        Args:
            value: List value to validate
            item_validator: Function to validate each item
            min_length: Minimum list length
            max_length: Maximum list length

        Returns:
            Validated list

        Raises:
            ValidationError: If validation fails
        """
        if not isinstance(value, list):
            raise ValidationError("Value must be a list")

        # Check length constraints
        if len(value) < min_length:
            raise ValidationError(f"List must have at least {min_length} items")

        if max_length is not None and len(value) > max_length:
            raise ValidationError(f"List must have at most {max_length} items")

        # Validate each item
        if item_validator:
            validated_items = []
            for i, item in enumerate(value):
                try:
                    validated_items.append(item_validator(item))
                except ValidationError as e:
                    raise ValidationError(f"Invalid item at index {i}: {e.message}")
            return validated_items

        return value

    def validate_dict(self, value: Any, schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Validate dictionary value

        Args:
            value: Dictionary value to validate
            schema: Schema to validate against

        Returns:
            Validated dictionary

        Raises:
            ValidationError: If validation fails
        """
        if not isinstance(value, dict):
            raise ValidationError("Value must be a dictionary")

        if schema:
            return self.validate_schema(value, schema)

        return value

    def validate_schema(self, data: Dict[str, Any], schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate data against a schema

        Args:
            data: Data to validate
            schema: Validation schema

        Returns:
            Validated data

        Raises:
            SchemaValidationError: If schema validation fails
        """
        self.validation_errors = []
        validated_data = {}

        # Process each field in the schema
        for field_name, field_schema in schema.items():
            try:
                field_value = data.get(field_name)

                # Check if field is required
                if field_schema.get('required', False) and field_value is None:
                    raise ValidationError(f"Field '{field_name}' is required")

                # Skip validation if field is None and not required
                if field_value is None:
                    validated_data[field_name] = None
                    continue

                # Apply field validation based on type
                field_type = field_schema.get('type', 'string')

                if field_type == 'string':
                    validated_data[field_name] = self.validate_string(
                        field_value,
                        min_length=field_schema.get('min_length', 0),
                        max_length=field_schema.get('max_length'),
                        pattern=field_schema.get('pattern'),
                        allowed_values=field_schema.get('allowed_values')
                    )
                elif field_type == 'integer':
                    validated_data[field_name] = self.validate_integer(
                        field_value,
                        min_value=field_schema.get('min_value'),
                        max_value=field_schema.get('max_value')
                    )
                elif field_type == 'float':
                    validated_data[field_name] = self.validate_float(
                        field_value,
                        min_value=field_schema.get('min_value'),
                        max_value=field_schema.get('max_value'),
                        precision=field_schema.get('precision')
                    )
                elif field_type == 'boolean':
                    validated_data[field_name] = self.validate_boolean(field_value)
                elif field_type == 'email':
                    validated_data[field_name] = self.validate_email(field_value)
                elif field_type == 'url':
                    validated_data[field_name] = self.validate_url(
                        field_value,
                        schemes=field_schema.get('schemes')
                    )
                elif field_type == 'date':
                    validated_data[field_name] = self.validate_date(
                        field_value,
                        date_format=field_schema.get('format', '%Y-%m-%d')
                    )
                elif field_type == 'datetime':
                    validated_data[field_name] = self.validate_datetime(
                        field_value,
                        datetime_format=field_schema.get('format', '%Y-%m-%d %H:%M:%S')
                    )
                elif field_type == 'list':
                    item_schema = field_schema.get('item_schema')
                    item_validator = None
                    if item_schema:
                        item_validator = lambda x: self.validate_schema(x, item_schema) if isinstance(x, dict) else x

                    validated_data[field_name] = self.validate_list(
                        field_value,
                        item_validator=item_validator,
                        min_length=field_schema.get('min_length', 0),
                        max_length=field_schema.get('max_length')
                    )
                elif field_type == 'dict':
                    nested_schema = field_schema.get('schema')
                    validated_data[field_name] = self.validate_dict(field_value, nested_schema)
                else:
                    # Unknown type, store as-is
                    validated_data[field_name] = field_value

            except ValidationError as e:
                self.validation_errors.append(f"{field_name}: {e.message}")

        # Check for unexpected fields in strict mode
        if self.strict_mode:
            for field_name in data:
                if field_name not in schema:
                    self.validation_errors.append(f"Unexpected field: {field_name}")

        # Raise exception if there were validation errors
        if self.validation_errors:
            raise SchemaValidationError(
                f"Schema validation failed: {'; '.join(self.validation_errors)}"
            )

        return validated_data

    def validate_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate user data

        Args:
            user_data: User data to validate

        Returns:
            Validated user data
        """
        user_schema = {
            'id': {'type': 'string', 'required': True, 'pattern': r'^[a-zA-Z0-9_-]+$'},
            'name': {'type': 'string', 'required': True, 'min_length': 1, 'max_length': 100},
            'email': {'type': 'email', 'required': True},
            'age': {'type': 'integer', 'min_value': 0, 'max_value': 150},
            'is_active': {'type': 'boolean', 'required': False},
            'created_at': {'type': 'datetime', 'required': False},
            'profile': {
                'type': 'dict',
                'required': False,
                'schema': {
                    'bio': {'type': 'string', 'max_length': 500},
                    'website': {'type': 'url', 'required': False},
                    'avatar_url': {'type': 'url', 'required': False}
                }
            }
        }

        return self.validate_schema(user_data, user_schema)

    def validate_registration_data(self, registration_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate user registration data

        Args:
            registration_data: Registration data to validate

        Returns:
            Validated registration data
        """
        registration_schema = {
            'username': {
                'type': 'string',
                'required': True,
                'min_length': 3,
                'max_length': 30,
                'pattern': r'^[a-zA-Z0-9_]+$'
            },
            'email': {'type': 'email', 'required': True},
            'password': {
                'type': 'string',
                'required': True,
                'min_length': 8,
                'max_length': 128
            },
            'first_name': {
                'type': 'string',
                'required': True,
                'min_length': 1,
                'max_length': 50
            },
            'last_name': {
                'type': 'string',
                'required': True,
                'min_length': 1,
                'max_length': 50
            },
            'birth_date': {'type': 'date', 'required': False},
            'terms_accepted': {'type': 'boolean', 'required': True}
        }

        validated_data = self.validate_schema(registration_data, registration_schema)

        # Additional validation
        if validated_data['terms_accepted'] is not True:
            raise ValidationError("Terms and conditions must be accepted")

        # Validate password strength
        password = validated_data['password']
        if not self._validate_password_strength(password):
            raise ValidationError("Password must contain at least one uppercase letter, one lowercase letter, and one number")

        return validated_data

    def _validate_password_strength(self, password: str) -> bool:
        """
        Validate password strength

        Args:
            password: Password to validate

        Returns:
            True if password is strong enough
        """
        # Check for at least one uppercase, one lowercase, and one digit
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)

        return has_upper and has_lower and has_digit

    def validate_json(self, value: Any) -> Dict[str, Any]:
        """
        Validate JSON string or object

        Args:
            value: JSON string or object to validate

        Returns:
            Parsed JSON object

        Raises:
            ValidationError: If JSON is invalid
        """
        if isinstance(value, dict):
            return value

        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError as e:
                raise ValidationError(f"Invalid JSON: {e}")

        raise ValidationError("Value must be a JSON string or dictionary")

    def reset_errors(self) -> None:
        """Reset validation errors list"""
        self.validation_errors = []

    def get_errors(self) -> List[str]:
        """
        Get current validation errors

        Returns:
            List of validation error messages
        """
        return self.validation_errors.copy()


# Standalone validation functions
def validate_required_fields(data: Dict[str, Any], required_fields: List[str]) -> None:
    """
    Validate that all required fields are present

    Args:
        data: Data dictionary to check
        required_fields: List of required field names

    Raises:
        ValidationError: If any required fields are missing
    """
    missing_fields = [field for field in required_fields if field not in data or data[field] is None]

    if missing_fields:
        raise ValidationError(f"Missing required fields: {', '.join(missing_fields)}")


def sanitize_string(value: str, allowed_chars: Optional[str] = None, max_length: Optional[int] = None) -> str:
    """
    Sanitize string by removing unwanted characters

    Args:
        value: String to sanitize
        allowed_chars: String of allowed characters (if None, allows alphanumeric and common punctuation)
        max_length: Maximum length to truncate to

    Returns:
        Sanitized string
    """
    if not isinstance(value, str):
        value = str(value)

    if allowed_chars is None:
        # Default allowed characters: alphanumeric, spaces, and common punctuation
        allowed_chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-_@'

    sanitized = ''.join(char for char in value if char in allowed_chars)

    if max_length:
        sanitized = sanitized[:max_length]

    return sanitized.strip()


# Export public API
__all__ = [
    'DataValidator',
    'ValidationError',
    'SchemaValidationError',
    'validate_required_fields',
    'sanitize_string'
]
