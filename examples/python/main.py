#!/usr/bin/env python3
"""
Main application entry point
Demonstrates dependency relationships between Python modules
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional

# Local imports that will create dependency relationships
from utils.logger import get_logger, setup_logging
from utils.config_loader import load_config, validate_config
from utils.database import DatabaseManager
from utils.api_client import APIClient
from utils.validator import DataValidator
from utils.formatter import DataFormatter
from services.user_service import UserService
from services.notification_service import NotificationService
from models.user import User
from models.notification import Notification

# Module-level logger
logger = get_logger(__name__)


class Application:
    """Main application class that orchestrates all services"""

    def __init__(self, config_path: str = "config.yaml"):
        self.config_path = config_path
        self.config = None
        self.db_manager = None
        self.api_client = None
        self.user_service = None
        self.notification_service = None
        self.data_validator = DataValidator()
        self.data_formatter = DataFormatter()
        self.running = False

    async def initialize(self) -> None:
        """Initialize all application components"""
        try:
            logger.info("Starting application initialization...")

            # Load and validate configuration
            self.config = load_config(self.config_path)
            validate_config(self.config)

            # Setup logging with config
            setup_logging(self.config.get('logging', {}))

            # Initialize database manager
            self.db_manager = DatabaseManager(self.config['database'])
            await self.db_manager.connect()

            # Initialize API client
            self.api_client = APIClient(
                base_url=self.config['api']['base_url'],
                timeout=self.config['api'].get('timeout', 30)
            )

            # Initialize services
            self.user_service = UserService(
                db_manager=self.db_manager,
                api_client=self.api_client,
                validator=self.data_validator
            )

            self.notification_service = NotificationService(
                db_manager=self.db_manager,
                formatter=self.data_formatter
            )

            logger.info("Application initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize application: {e}")
            raise

    async def start(self) -> None:
        """Start the application"""
        if not self.config:
            await self.initialize()

        try:
            logger.info("Starting application services...")
            self.running = True

            # Start background tasks
            tasks = [
                self._user_sync_task(),
                self._notification_processor_task(),
                self._health_check_task()
            ]

            await asyncio.gather(*tasks)

        except KeyboardInterrupt:
            logger.info("Received shutdown signal")
            await self.shutdown()
        except Exception as e:
            logger.error(f"Application error: {e}")
            await self.shutdown()
            raise

    async def shutdown(self) -> None:
        """Gracefully shutdown the application"""
        logger.info("Shutting down application...")
        self.running = False

        try:
            # Close API client
            if self.api_client:
                await self.api_client.close()

            # Close database connections
            if self.db_manager:
                await self.db_manager.disconnect()

        except Exception as e:
            logger.error(f"Error during shutdown: {e}")

        logger.info("Application shutdown complete")

    async def _user_sync_task(self) -> None:
        """Background task for syncing user data"""
        while self.running:
            try:
                logger.debug("Running user sync task...")

                # Get users that need syncing
                users = await self.user_service.get_users_for_sync()

                for user in users:
                    # Validate user data
                    if self.data_validator.validate_user(user.to_dict()):
                        # Sync with external API
                        updated_data = await self.api_client.sync_user(user.id)
                        if updated_data:
                            # Update user in database
                            await self.user_service.update_user(user.id, updated_data)

                            # Send notification if needed
                            if updated_data.get('send_notification'):
                                notification = Notification(
                                    user_id=user.id,
                                    message="Your profile has been updated",
                                    type="profile_update"
                                )
                                await self.notification_service.send_notification(notification)

                # Wait before next sync
                await asyncio.sleep(self.config.get('sync_interval', 300))  # 5 minutes default

            except Exception as e:
                logger.error(f"User sync task error: {e}")
                await asyncio.sleep(60)  # Wait 1 minute on error

    async def _notification_processor_task(self) -> None:
        """Background task for processing notifications"""
        while self.running:
            try:
                logger.debug("Processing notifications...")

                # Get pending notifications
                notifications = await self.notification_service.get_pending_notifications()

                for notification in notifications:
                    # Format notification message
                    formatted_message = self.data_formatter.format_notification(notification)

                    # Send notification
                    success = await self.notification_service.send_notification(
                        notification, formatted_message
                    )

                    if success:
                        # Mark as sent
                        await self.notification_service.mark_as_sent(notification.id)
                    else:
                        # Mark as failed and potentially retry later
                        await self.notification_service.mark_as_failed(notification.id)

                # Wait before next processing cycle
                await asyncio.sleep(30)  # Process every 30 seconds

            except Exception as e:
                logger.error(f"Notification processor error: {e}")
                await asyncio.sleep(60)

    async def _health_check_task(self) -> None:
        """Background task for health checks"""
        while self.running:
            try:
                logger.debug("Running health checks...")

                health_status = {
                    'timestamp': datetime.utcnow().isoformat(),
                    'database': await self.db_manager.health_check(),
                    'api': await self.api_client.health_check(),
                    'services': {
                        'user_service': self.user_service.is_healthy(),
                        'notification_service': self.notification_service.is_healthy()
                    }
                }

                # Log health status
                if all(health_status['services'].values()) and health_status['database'] and health_status['api']:
                    logger.debug("All systems healthy")
                else:
                    logger.warning(f"Health check issues detected: {health_status}")

                # Wait before next health check
                await asyncio.sleep(self.config.get('health_check_interval', 60))

            except Exception as e:
                logger.error(f"Health check error: {e}")
                await asyncio.sleep(60)

    async def process_user_registration(self, user_data: Dict) -> Optional[User]:
        """Process a new user registration"""
        try:
            # Validate input data
            if not self.data_validator.validate_registration_data(user_data):
                logger.warning("Invalid registration data provided")
                return None

            # Create user through service
            user = await self.user_service.create_user(user_data)

            if user:
                # Send welcome notification
                welcome_notification = Notification(
                    user_id=user.id,
                    message=f"Welcome to the platform, {user.name}!",
                    type="welcome"
                )
                await self.notification_service.queue_notification(welcome_notification)

                logger.info(f"User registered successfully: {user.id}")
                return user

        except Exception as e:
            logger.error(f"User registration failed: {e}")

        return None


async def main():
    """Main entry point"""
    app = Application()

    try:
        await app.start()
    except Exception as e:
        logger.error(f"Application failed to start: {e}")
        sys.exit(1)


if __name__ == "__main__":
    # Set up basic logging for startup
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Run the application
    asyncio.run(main())
