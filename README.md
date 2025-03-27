# Bucky - Backup Manager

> [!WARNING]  
> This software is on a very early alpha stage, do NOT use it for critical data

Bucky is a modern, easy-to-use backup manager that helps you automate and manage your backups across multiple storage providers. Built with Next.js and Bun, it provides a beautiful UI for managing your backup jobs and monitoring their status.

## Features

- Support for multiple storage providers:
  - Amazon S3
  - Backblaze B2
  - Storj
- Automated backup scheduling with cron expressions
- File compression and encryption
- Backup retention policies
- Email notifications for backup status
- Beautiful, modern UI
- Easy deployment with Docker

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Bun (for local development)

## Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/bucky.git
   cd bucky
   ```

2. Create a `docker-compose.yml` file:
   ```yaml
   version: '3.8'

   services:
     bucky:
       build: .
       ports:
         - "3000:3000"
       volumes:
         - ./data:/app/data  # For persistent storage of SQLite database
         - ./backups:/app/backups  # For local file backups
       environment:
         - NODE_ENV=production
       restart: unless-stopped
   ```

3. Start the application:
   ```bash
   docker-compose up -d
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Local Development

1. Install dependencies:
   ```bash
   bun install
   ```

2. Start the development server:
   ```bash
   bun run dev
   ```

3. Open your browser and navigate to `http://localhost:3000`

## Configuration

### Storage Providers

1. Navigate to the Storage section in the UI
2. Add your storage provider credentials:
   - For S3: Access Key ID, Secret Access Key, Region, and Bucket name
   - For B2: Application Key ID, Application Key, Bucket ID, and Bucket name
   - For Storj: Access Key ID, Secret Access Key, and Bucket name

### Backup Jobs

1. Navigate to the Jobs section in the UI
2. Click "Create New Job"
3. Configure your backup job:
   - Name: A descriptive name for your backup job
   - Source Path: The path to the files you want to backup
   - Destination Provider: Select your configured storage provider
   - Schedule: A cron expression for when to run the backup
   - Retention Days: How long to keep old backups
   - Compression: Whether to compress the backup
   - Encryption: Whether to encrypt the backup

### Email Notifications

1. Navigate to the Settings section in the UI
2. Configure your SMTP settings:
   - SMTP Host
   - SMTP Port
   - Username
   - Password
   - From Email
   - From Name

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.