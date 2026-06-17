# Docker Dev Setup — Design

**Date:** 2026-06-17  
**Status:** Approved

## Problem

`start.ps1` fails on machines without `bun` installed locally. The check is wrong: bun runs inside Docker, not on the host.

## Solution

Fix `start.ps1` to:
1. Remove the spurious bun host check (lines 19–30)
2. Target `docker-compose.debug.yml` instead of the `docker-compose.yml + docker-compose.dev.yml` overlay

## Architecture

Single compose file: `docker-compose.debug.yml` (already exists, no changes needed).

| Service  | Image             | Ports        | Notes               |
|----------|-------------------|--------------|---------------------|
| postgres | postgres:16       | 5432         | healthcheck enabled |
| minio    | minio/minio       | 9000, 9001   | object storage      |
| db-init  | postgres:16       | —            | schema + seed       |
| backend  | oven/bun:1.1.29   | 3000, 9229   | hot-reload, inspector |
| frontend | node:20-alpine    | 5173         | Vite HMR            |
| adminer  | adminer:4         | 8888         | Postgres GUI        |

## Changes

**File:** `start.ps1`

- Remove lines 19–30 (bun host check)
- Replace compose target:
  ```
  # before
  docker compose -f docker-compose.yml -f docker-compose.dev.yml down
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
  docker compose logs -f --tail=100

  # after
  docker compose -f docker-compose.debug.yml down
  docker compose -f docker-compose.debug.yml up -d
  docker compose -f docker-compose.debug.yml logs -f --tail=100
  ```

## Requirements

Host needs only: **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux).

No bun, no node, no npm on host.
