POC Mode
========

Overview
--------
This folder contains configuration and seed files to enable a Proof-Of-Concept (POC) mode for the API. When POC mode is enabled the database will be reset to a known state at startup and every hour on the hour.

Files
-----
- `poc-config.json` : configuration for POC defaults (products, users, images)
- `poc_seed.sql` : SQL script that resets key tables and inserts sample data

How to enable
-------------
1. In `docker-compose.yml` set the environment variable under the `api` service:

```powershell
POC_MODE: 'true'
POC_CONFIG_PATH: /usr/src/app/poc-config.json
```

2. Make sure `poc-res` images are present in the repository root `poc_res/` (PNG files). The startup routine will copy images into `api/uploads/` preserving original filenames.

Manual reset endpoint
---------------------
You can trigger a manual reset via the admin endpoint (requires admin JWT):

```http
POST /admin/resetdb
Authorization: Bearer <admin-jwt>
```

Notes
-----
- The reset routine will clear `uploads/` (if configured) and copy POC images there.
- The endpoint uses the existing `adminAuth` protection.
