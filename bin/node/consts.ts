export const MODE_MIGRATE_INIT = "migrate-init";
export const MODE_MIGRATE_LATEST = "migrate-latest";
export const MODE_MIGRATE_DOWN = "migrate-down";
export const MODE = [
  MODE_MIGRATE_INIT,
  MODE_MIGRATE_LATEST,
  MODE_MIGRATE_DOWN,
] as const;
