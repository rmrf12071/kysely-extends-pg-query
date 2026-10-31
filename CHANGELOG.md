# kysely-extends-pg-query changelog

## 0.3.1 (2026-10-31)

- fix: serialize JSON values in conflict updates without auto-update settings, including when the INSERT omits the JSON column
- fix: preserve `ON CONFLICT DO NOTHING` without adding automatic updates
- fix: release migration connections on success and failure, and let the CLI exit naturally with the appropriate exit code

## 0.3.0 (2026-10-23)

- BREAKING CHANGE: require Node.js v22 or later; older versions are no longer supported. Development, tests, and builds require Node.js v24 or later.
- fix: declare pg-pool as a peer dependency and include its public declaration types
- chore: explicitly distribute CommonJS with a TypeScript declaration entry point
- fix: use Dirent.parentPath for recursive migrations on Node.js v24
- chore: migrate tests and npm build from Deno to Node.js
- chore: add disposable PostgreSQL environment for tests

## 0.2.4

- feat: add SSL support for migration

### Notable changes

## 0.2.3

### Notable changes

- feat: add dry migration
- feat: migration by files recursively

## 0.2.2

### Notable changes

- feat: add utilily functions for manage schema

## 0.2.1

### Notable changes

- bugfix: fix entrypoint for node.js

## 0.2.0

### Notable changes

- deps: update kysely to 0.27.3
- feat: add command to migrate for node.js

## 0.1.7

### Notable changes

- doc: add "executeTotal"

## 0.1.6

### Notable changes

- feat: add "executeTotal"
- bugfix: "executePagination" with "group by"

## 0.1.5

### Notable changes

- feat: add option to "executePagination" for complex SQL

## 0.1.4

### Notable changes

- bugfix: "executePagination" with "order by"

## 0.1.3

### Notable changes

- bugfix: "auto update" works on table of no "jsonColumns"

## 0.1.2

### Notable changes

- bugfix: "auto update" works on table of no "jsonColumns"
- bugfix: fix type of executePagination

## 0.1.1

### Notable changes

- feat: "auto update" feature on plugin supports "onConflict"

## 0.1.0

### Notable changes

- feat: add "auto update" feature to plugin
- feat: add utility function "executePagination"

## 0.0.2

### Notable changes

- feat: support Node.js via npm
- feat: "auto `JSON.stringify` for json/jsonb column(s)"" supports null and onConflict
- doc: adjust usage

## 0.0.1

### Notable changes

- feat: add auto `JSON.stringify` for json/jsonb column(s)
