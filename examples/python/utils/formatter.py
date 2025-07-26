"""
Data formatting utility module
Provides comprehensive formatting functions for various data types and output formats
"""

import json
import csv
import xml.etree.ElementTree as ET
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union, IO
from io import StringIO
import html
import re

from .logger import get_logger, ContextLogger
from .validator import DataValidator, ValidationError

logger = get_logger(__name__)


class FormattingError(Exception):
    """Custom exception for formatting-related errors"""
    pass


class DataFormatter:
    """
    Comprehensive data formatter with support for multiple output formats
    """

    def __init__(self, locale: str = 'en_US', timezone: str = 'UTC'):
        """
        Initialize the formatter

        Args:
            locale: Locale for formatting (default: en_US)
            timezone: Timezone for datetime formatting (default: UTC)
        """
        self.locale = locale
        self.timezone = timezone
        self.validator = DataValidator()

        # Default formatting options
        self.default_options = {
            'date_format': '%Y-%m-%d',
            'datetime_format': '%Y-%m-%d %H:%M:%S',
            'time_format': '%H:%M:%S',
            'decimal_places': 2,
            'thousands_separator': ',',
            'decimal_separator': '.',
            'currency_symbol': '$',
            'boolean_true': 'True',
            'boolean_false': 'False',
            'null_value': 'None',
            'indent_size': 2
        }

    def format_datetime(self, dt: Union[datetime, str], format_string: Optional[str] = None) -> str:
        """
        Format datetime object or string

        Args:
            dt: Datetime object or ISO string
            format_string: Custom format string

        Returns:
            Formatted datetime string

        Raises:
            FormattingError: If formatting fails
        """
        try:
            if isinstance(dt, str):
                # Try to parse ISO format
                dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
            elif not isinstance(dt, datetime):
                raise FormattingError(f"Expected datetime object or string, got {type(dt).__name__}")

            format_str = format_string or self.default_options['datetime_format']
            return dt.strftime(format_str)

        except Exception as e:
            logger.error(f"Failed to format datetime: {e}")
            raise FormattingError(f"Datetime formatting failed: {e}")

    def format_date(self, d: Union[date, datetime, str], format_string: Optional[str] = None) -> str:
        """
        Format date object or string

        Args:
            d: Date object, datetime object, or ISO string
            format_string: Custom format string

        Returns:
            Formatted date string

        Raises:
            FormattingError: If formatting fails
        """
        try:
            if isinstance(d, str):
                # Try to parse ISO format
                parsed_dt = datetime.fromisoformat(d.replace('Z', '+00:00'))
                d = parsed_dt.date()
            elif isinstance(d, datetime):
                d = d.date()
            elif not isinstance(d, date):
                raise FormattingError(f"Expected date object or string, got {type(d).__name__}")

            format_str = format_string or self.default_options['date_format']
            return d.strftime(format_str)

        except Exception as e:
            logger.error(f"Failed to format date: {e}")
            raise FormattingError(f"Date formatting failed: {e}")

    def format_number(self, number: Union[int, float, Decimal], decimal_places: Optional[int] = None,
                     use_thousands_separator: bool = True) -> str:
        """
        Format numeric value

        Args:
            number: Numeric value to format
            decimal_places: Number of decimal places
            use_thousands_separator: Whether to use thousands separator

        Returns:
            Formatted number string

        Raises:
            FormattingError: If formatting fails
        """
        try:
            if not isinstance(number, (int, float, Decimal)):
                raise FormattingError(f"Expected numeric value, got {type(number).__name__}")

            decimal_places = decimal_places if decimal_places is not None else self.default_options['decimal_places']

            # Format the number
            if isinstance(number, float) and number.is_integer():
                formatted = f"{int(number)}"
            else:
                formatted = f"{number:.{decimal_places}f}"

            # Add thousands separator if requested
            if use_thousands_separator and self.default_options['thousands_separator']:
                parts = formatted.split('.')
                parts[0] = re.sub(r'\B(?=(\d{3})+(?!\d))', self.default_options['thousands_separator'], parts[0])
                formatted = '.'.join(parts)

            # Replace decimal separator if different
            if self.default_options['decimal_separator'] != '.':
                formatted = formatted.replace('.', self.default_options['decimal_separator'])

            return formatted

        except Exception as e:
            logger.error(f"Failed to format number: {e}")
            raise FormattingError(f"Number formatting failed: {e}")

    def format_currency(self, amount: Union[int, float, Decimal], currency_symbol: Optional[str] = None,
                       decimal_places: int = 2) -> str:
        """
        Format currency value

        Args:
            amount: Currency amount
            currency_symbol: Currency symbol to use
            decimal_places: Number of decimal places

        Returns:
            Formatted currency string

        Raises:
            FormattingError: If formatting fails
        """
        try:
            symbol = currency_symbol or self.default_options['currency_symbol']
            formatted_number = self.format_number(amount, decimal_places)
            return f"{symbol}{formatted_number}"

        except Exception as e:
            logger.error(f"Failed to format currency: {e}")
            raise FormattingError(f"Currency formatting failed: {e}")

    def format_percentage(self, value: Union[int, float], decimal_places: int = 1, multiply_by_100: bool = True) -> str:
        """
        Format percentage value

        Args:
            value: Percentage value
            decimal_places: Number of decimal places
            multiply_by_100: Whether to multiply by 100 (for 0.15 -> 15%)

        Returns:
            Formatted percentage string

        Raises:
            FormattingError: If formatting fails
        """
        try:
            if not isinstance(value, (int, float)):
                raise FormattingError(f"Expected numeric value, got {type(value).__name__}")

            percentage_value = value * 100 if multiply_by_100 else value
            formatted_number = self.format_number(percentage_value, decimal_places, use_thousands_separator=False)
            return f"{formatted_number}%"

        except Exception as e:
            logger.error(f"Failed to format percentage: {e}")
            raise FormattingError(f"Percentage formatting failed: {e}")

    def format_file_size(self, size_bytes: int, binary: bool = True) -> str:
        """
        Format file size in human-readable format

        Args:
            size_bytes: Size in bytes
            binary: Use binary (1024) or decimal (1000) units

        Returns:
            Formatted file size string

        Raises:
            FormattingError: If formatting fails
        """
        try:
            if not isinstance(size_bytes, int) or size_bytes < 0:
                raise FormattingError("File size must be a non-negative integer")

            if size_bytes == 0:
                return "0 B"

            # Choose units and divisor
            if binary:
                units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB']
                divisor = 1024
            else:
                units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']
                divisor = 1000

            # Calculate the appropriate unit
            unit_index = 0
            size = float(size_bytes)

            while size >= divisor and unit_index < len(units) - 1:
                size /= divisor
                unit_index += 1

            # Format with appropriate decimal places
            if unit_index == 0:  # Bytes
                return f"{int(size)} {units[unit_index]}"
            else:
                return f"{size:.1f} {units[unit_index]}"

        except Exception as e:
            logger.error(f"Failed to format file size: {e}")
            raise FormattingError(f"File size formatting failed: {e}")

    def format_duration(self, seconds: Union[int, float], format_style: str = 'long') -> str:
        """
        Format duration in human-readable format

        Args:
            seconds: Duration in seconds
            format_style: 'long' (1 hour 30 minutes) or 'short' (1h 30m)

        Returns:
            Formatted duration string

        Raises:
            FormattingError: If formatting fails
        """
        try:
            if not isinstance(seconds, (int, float)) or seconds < 0:
                raise FormattingError("Duration must be a non-negative number")

            if seconds == 0:
                return "0 seconds" if format_style == 'long' else "0s"

            # Convert to timedelta for easier handling
            delta = timedelta(seconds=seconds)
            days = delta.days
            hours, remainder = divmod(delta.seconds, 3600)
            minutes, secs = divmod(remainder, 60)

            parts = []

            if format_style == 'long':
                if days > 0:
                    parts.append(f"{days} day{'s' if days != 1 else ''}")
                if hours > 0:
                    parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
                if minutes > 0:
                    parts.append(f"{minutes} minute{'s' if minutes != 1 else ''}")
                if secs > 0 or not parts:  # Include seconds if it's the only unit
                    parts.append(f"{secs} second{'s' if secs != 1 else ''}")
            else:  # short format
                if days > 0:
                    parts.append(f"{days}d")
                if hours > 0:
                    parts.append(f"{hours}h")
                if minutes > 0:
                    parts.append(f"{minutes}m")
                if secs > 0 or not parts:
                    parts.append(f"{secs}s")

            return " ".join(parts)

        except Exception as e:
            logger.error(f"Failed to format duration: {e}")
            raise FormattingError(f"Duration formatting failed: {e}")

    def format_list(self, items: List[Any], separator: str = ', ', last_separator: str = ' and ',
                   formatter: Optional[callable] = None) -> str:
        """
        Format list as human-readable string

        Args:
            items: List of items to format
            separator: Separator between items
            last_separator: Separator before the last item
            formatter: Optional function to format each item

        Returns:
            Formatted list string

        Raises:
            FormattingError: If formatting fails
        """
        try:
            if not isinstance(items, list):
                raise FormattingError("Expected list of items")

            if not items:
                return ""

            # Apply formatter to each item if provided
            if formatter:
                formatted_items = [formatter(item) for item in items]
            else:
                formatted_items = [str(item) for item in items]

            if len(formatted_items) == 1:
                return formatted_items[0]
            elif len(formatted_items) == 2:
                return last_separator.join(formatted_items)
            else:
                return separator.join(formatted_items[:-1]) + last_separator + formatted_items[-1]

        except Exception as e:
            logger.error(f"Failed to format list: {e}")
            raise FormattingError(f"List formatting failed: {e}")

    def format_dict(self, data: Dict[str, Any], format_type: str = 'key_value') -> str:
        """
        Format dictionary as string

        Args:
            data: Dictionary to format
            format_type: 'key_value', 'json', or 'table'

        Returns:
            Formatted dictionary string

        Raises:
            FormattingError: If formatting fails
        """
        try:
            if not isinstance(data, dict):
                raise FormattingError("Expected dictionary")

            if not data:
                return "{}"

            if format_type == 'json':
                return json.dumps(data, indent=self.default_options['indent_size'], default=str)

            elif format_type == 'key_value':
                formatted_pairs = []
                for key, value in data.items():
                    formatted_value = self._format_value(value)
                    formatted_pairs.append(f"{key}: {formatted_value}")
                return "{ " + ", ".join(formatted_pairs) + " }"

            elif format_type == 'table':
                # Simple table format
                lines = []
                max_key_length = max(len(str(key)) for key in data.keys()) if data else 0

                for key, value in data.items():
                    formatted_value = self._format_value(value)
                    lines.append(f"{str(key).ljust(max_key_length)} | {formatted_value}")

                return "\n".join(lines)

            else:
                raise FormattingError(f"Unknown format type: {format_type}")

        except Exception as e:
            logger.error(f"Failed to format dictionary: {e}")
            raise FormattingError(f"Dictionary formatting failed: {e}")

    def format_notification(self, notification: Dict[str, Any]) -> str:
        """
        Format notification message

        Args:
            notification: Notification data dictionary

        Returns:
            Formatted notification message

        Raises:
            FormattingError: If formatting fails
        """
        try:
            # Validate notification structure
            required_fields = ['message', 'type']
            for field in required_fields:
                if field not in notification:
                    raise FormattingError(f"Missing required field: {field}")

            message = notification['message']
            notification_type = notification['type']
            timestamp = notification.get('timestamp', datetime.utcnow())
            user_name = notification.get('user_name', 'User')

            # Format timestamp
            formatted_time = self.format_datetime(timestamp, '%H:%M')

            # Create formatted message based on type
            if notification_type == 'welcome':
                return f"🎉 Welcome {user_name}! {message} [{formatted_time}]"
            elif notification_type == 'profile_update':
                return f"👤 Profile Update: {message} [{formatted_time}]"
            elif notification_type == 'system':
                return f"🔧 System: {message} [{formatted_time}]"
            elif notification_type == 'warning':
                return f"⚠️  Warning: {message} [{formatted_time}]"
            elif notification_type == 'error':
                return f"❌ Error: {message} [{formatted_time}]"
            else:
                return f"📝 {message} [{formatted_time}]"

        except Exception as e:
            logger.error(f"Failed to format notification: {e}")
            raise FormattingError(f"Notification formatting failed: {e}")

    def format_to_json(self, data: Any, pretty: bool = True) -> str:
        """
        Format data as JSON string

        Args:
            data: Data to format as JSON
            pretty: Whether to pretty-print the JSON

        Returns:
            JSON string

        Raises:
            FormattingError: If JSON serialization fails
        """
        try:
            if pretty:
                return json.dumps(data, indent=self.default_options['indent_size'], default=self._json_serializer)
            else:
                return json.dumps(data, default=self._json_serializer)

        except Exception as e:
            logger.error(f"Failed to format as JSON: {e}")
            raise FormattingError(f"JSON formatting failed: {e}")

    def format_to_csv(self, data: List[Dict[str, Any]], output: Optional[IO] = None) -> str:
        """
        Format data as CSV

        Args:
            data: List of dictionaries to format as CSV
            output: Optional output stream

        Returns:
            CSV string if no output stream provided

        Raises:
            FormattingError: If CSV formatting fails
        """
        try:
            if not isinstance(data, list):
                raise FormattingError("Expected list of dictionaries")

            if not data:
                return ""

            # Get all unique field names
            fieldnames = set()
            for row in data:
                if isinstance(row, dict):
                    fieldnames.update(row.keys())

            fieldnames = sorted(fieldnames)

            # Create CSV output
            output_stream = output or StringIO()
            writer = csv.DictWriter(output_stream, fieldnames=fieldnames)
            writer.writeheader()

            for row in data:
                if isinstance(row, dict):
                    # Format values in the row
                    formatted_row = {}
                    for key, value in row.items():
                        formatted_row[key] = self._format_value(value)
                    writer.writerow(formatted_row)

            if not output:
                return output_stream.getvalue()

        except Exception as e:
            logger.error(f"Failed to format as CSV: {e}")
            raise FormattingError(f"CSV formatting failed: {e}")

    def format_to_xml(self, data: Dict[str, Any], root_element: str = 'root') -> str:
        """
        Format dictionary as XML

        Args:
            data: Dictionary to format as XML
            root_element: Name of the root XML element

        Returns:
            XML string

        Raises:
            FormattingError: If XML formatting fails
        """
        try:
            if not isinstance(data, dict):
                raise FormattingError("Expected dictionary for XML formatting")

            root = ET.Element(root_element)
            self._dict_to_xml(data, root)

            # Convert to string
            ET.indent(root, space="  ")  # Pretty print
            return ET.tostring(root, encoding='unicode')

        except Exception as e:
            logger.error(f"Failed to format as XML: {e}")
            raise FormattingError(f"XML formatting failed: {e}")

    def format_to_html_table(self, data: List[Dict[str, Any]], table_class: str = 'data-table') -> str:
        """
        Format data as HTML table

        Args:
            data: List of dictionaries to format as HTML table
            table_class: CSS class for the table

        Returns:
            HTML table string

        Raises:
            FormattingError: If HTML formatting fails
        """
        try:
            if not isinstance(data, list):
                raise FormattingError("Expected list of dictionaries")

            if not data:
                return f'<table class="{table_class}"><tr><td>No data</td></tr></table>'

            # Get all unique field names
            fieldnames = set()
            for row in data:
                if isinstance(row, dict):
                    fieldnames.update(row.keys())

            fieldnames = sorted(fieldnames)

            # Build HTML table
            html_parts = [f'<table class="{table_class}">']

            # Header row
            html_parts.append('<tr>')
            for field in fieldnames:
                html_parts.append(f'<th>{html.escape(str(field))}</th>')
            html_parts.append('</tr>')

            # Data rows
            for row in data:
                if isinstance(row, dict):
                    html_parts.append('<tr>')
                    for field in fieldnames:
                        value = row.get(field, '')
                        formatted_value = self._format_value(value)
                        html_parts.append(f'<td>{html.escape(str(formatted_value))}</td>')
                    html_parts.append('</tr>')

            html_parts.append('</table>')
            return '\n'.join(html_parts)

        except Exception as e:
            logger.error(f"Failed to format as HTML table: {e}")
            raise FormattingError(f"HTML table formatting failed: {e}")

    def _format_value(self, value: Any) -> str:
        """
        Format a single value based on its type

        Args:
            value: Value to format

        Returns:
            Formatted string representation
        """
        if value is None:
            return self.default_options['null_value']
        elif isinstance(value, bool):
            return self.default_options['boolean_true'] if value else self.default_options['boolean_false']
        elif isinstance(value, datetime):
            return self.format_datetime(value)
        elif isinstance(value, date):
            return self.format_date(value)
        elif isinstance(value, (int, float, Decimal)):
            return self.format_number(value)
        elif isinstance(value, list):
            return self.format_list(value)
        elif isinstance(value, dict):
            return self.format_dict(value, 'key_value')
        else:
            return str(value)

    def _json_serializer(self, obj: Any) -> str:
        """
        Custom JSON serializer for non-standard types

        Args:
            obj: Object to serialize

        Returns:
            Serializable representation
        """
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        elif isinstance(obj, Decimal):
            return float(obj)
        elif hasattr(obj, 'to_dict'):
            return obj.to_dict()
        else:
            return str(obj)

    def _dict_to_xml(self, data: Dict[str, Any], parent: ET.Element) -> None:
        """
        Convert dictionary to XML elements

        Args:
            data: Dictionary to convert
            parent: Parent XML element
        """
        for key, value in data.items():
            # Sanitize element name
            element_name = re.sub(r'[^a-zA-Z0-9_-]', '_', str(key))
            element = ET.SubElement(parent, element_name)

            if isinstance(value, dict):
                self._dict_to_xml(value, element)
            elif isinstance(value, list):
                for i, item in enumerate(value):
                    item_element = ET.SubElement(element, f'item_{i}')
                    if isinstance(item, dict):
                        self._dict_to_xml(item, item_element)
                    else:
                        item_element.text = str(item)
            else:
                element.text = str(value)

    def create_report(self, title: str, data: Dict[str, Any], format_type: str = 'text') -> str:
        """
        Create a formatted report

        Args:
            title: Report title
            data: Report data
            format_type: Output format ('text', 'html', 'json')

        Returns:
            Formatted report string

        Raises:
            FormattingError: If report generation fails
        """
        with ContextLogger(logger, f"generate_{format_type}_report", title=title):
            try:
                timestamp = self.format_datetime(datetime.utcnow())

                if format_type == 'text':
                    return self._create_text_report(title, data, timestamp)
                elif format_type == 'html':
                    return self._create_html_report(title, data, timestamp)
                elif format_type == 'json':
                    return self._create_json_report(title, data, timestamp)
                else:
                    raise FormattingError(f"Unsupported report format: {format_type}")

            except Exception as e:
                logger.error(f"Failed to create {format_type} report: {e}")
                raise FormattingError(f"Report generation failed: {e}")

    def _create_text_report(self, title: str, data: Dict[str, Any], timestamp: str) -> str:
        """Create text format report"""
        lines = [
            "=" * 60,
            f"REPORT: {title}",
            f"Generated: {timestamp}",
            "=" * 60,
            ""
        ]

        for section, section_data in data.items():
            lines.append(f"{section.upper()}")
            lines.append("-" * len(section))

            if isinstance(section_data, dict):
                for key, value in section_data.items():
                    formatted_value = self._format_value(value)
                    lines.append(f"  {key}: {formatted_value}")
            elif isinstance(section_data, list):
                for i, item in enumerate(section_data, 1):
                    formatted_item = self._format_value(item)
                    lines.append(f"  {i}. {formatted_item}")
            else:
                lines.append(f"  {self._format_value(section_data)}")

            lines.append("")

        return "\n".join(lines)

    def _create_html_report(self, title: str, data: Dict[str, Any], timestamp: str) -> str:
        """Create HTML format report"""
        html_parts = [
            "<!DOCTYPE html>",
            "<html>",
            "<head>",
            f"<title>{html.escape(title)}</title>",
            "<style>",
            "body { font-family: Arial, sans-serif; margin: 20px; }",
            "h1 { color: #333; border-bottom: 2px solid #ddd; }",
            "h2 { color: #666; }",
            "table { border-collapse: collapse; width: 100%; margin: 10px 0; }",
            "th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }",
            "th { background-color: #f5f5f5; }",
            ".timestamp { font-size: 0.9em; color: #666; }",
            "</style>",
            "</head>",
            "<body>",
            f"<h1>{html.escape(title)}</h1>",
            f"<p class='timestamp'>Generated: {html.escape(timestamp)}</p>"
        ]

        for section, section_data in data.items():
            html_parts.append(f"<h2>{html.escape(section)}</h2>")

            if isinstance(section_data, list) and all(isinstance(item, dict) for item in section_data):
                # Format as table
                html_parts.append(self.format_to_html_table(section_data))
            else:
                html_parts.append(f"<pre>{html.escape(self._format_value(section_data))}</pre>")

        html_parts.extend(["</body>", "</html>"])
        return "\n".join(html_parts)

    def _create_json_report(self, title: str, data: Dict[str, Any], timestamp: str) -> str:
        """Create JSON format report"""
        report_data = {
            'title': title,
            'timestamp': timestamp,
            'data': data
        }
        return self.format_to_json(report_data)


# Standalone formatting functions
def format_bytes(size_bytes: int) -> str:
    """Quick function to format file size"""
    formatter = DataFormatter()
    return formatter.format_file_size(size_bytes)


def format_duration_seconds(seconds: Union[int, float]) -> str:
    """Quick function to format duration"""
    formatter = DataFormatter()
    return formatter.format_duration(seconds)


def format_timestamp(dt: datetime) -> str:
    """Quick function to format timestamp"""
    formatter = DataFormatter()
    return formatter.format_datetime(dt)


# Export public API
__all__ = [
    'DataFormatter',
    'FormattingError',
    'format_bytes',
    'format_duration_seconds',
    'format_timestamp'
]
