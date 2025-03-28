# Bucky

> [!WARNING]  
> This software is on a very early alpha stage, do NOT use it for critical data

The self-hosted all-in-one backup solution that doesn't suck.

## Features

* 💅🏼 Nice **modern UI**
* 📁 Scheduled backups of the **folders you choose**
* ☁️ Connect to **Cloud providers** like Storj (_more coming soon-ish_)
* 💯 **Rclone**: 1 to 1 copies on your remote. No chunking/compressing
* 📩 **Email notifications** of successful/failed backups
* 🐳 **Made for docker**. Drop it on your compose file and forget about it
* ♻️ _WIP: Restore from your backups_

## Screenshots

### Dashboard

![CleanShot 2025-03-28 at 17 51 12](https://github.com/user-attachments/assets/b4fb5f61-a253-4279-b7ae-23acf355df16)

### Storage

![CleanShot 2025-03-28 at 17 51 19](https://github.com/user-attachments/assets/2b4ad01c-98d7-4f86-8cdc-a7c6e6444962)

### Browse local and remote files

![CleanShot 2025-03-28 at 17 51 45](https://github.com/user-attachments/assets/5e2ba0c7-2d0d-4dae-b571-25ef903e1460)

### Email notifications

![CleanShot 2025-03-28 at 17 51 22](https://github.com/user-attachments/assets/8047e7c4-dfb9-4bf9-8309-801bcaddce97)

## Deploy in docker

```yaml
services:
  bucky:
    image: ghcr.io/pablopunk/bucky:latest
    container_name: bucky
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - bucky-data:/app/data # optional, to persist the database in a volume
      - /important/folder1:/folder1 # any folder you want to backup (with any path)
      - /important/folder2:/folder2
    environment:
      - DATABASE_PATH=/app/data/bucky.db # optional, to customize the db location

volumes:
  bucky-data:
```

## To do

- [ ] Add more storage providers
  - [ ] S3
  - [ ] B2
  - [ ] SFTP
- [ ] Restore functionality (pull the remote content into the local folder)
