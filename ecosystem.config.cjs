/**
 * pm2 process definitions for the workstation.
 *
 * Start everything:   pm2 start ecosystem.config.cjs
 * Reload after deploy: pm2 reload ecosystem.config.cjs
 *
 * The Next app reads .env.local from cwd.
 */
module.exports = {
  apps: [
    {
      name: "workspace-app",
      cwd: "/var/www/workspace-app",
      script: "npm",
      args: "run start",
      instances: 1,
      autorestart: true,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "temporal-worker",
      cwd: "/var/www/workspace-app",
      script: "server/temporal-worker.ts",
      interpreter: "tsx",
      instances: 1,
      autorestart: true,
      env: {
        TEMPORAL_ADDRESS: process.env.TEMPORAL_ADDRESS || "",
        TEMPORAL_NAMESPACE: process.env.TEMPORAL_NAMESPACE || "default",
        TEMPORAL_TASK_QUEUE: process.env.TEMPORAL_TASK_QUEUE || "workspace-tasks",
        INTERNAL_API_TOKEN: process.env.INTERNAL_API_TOKEN || "",
        APP_INTERNAL_URL: process.env.APP_INTERNAL_URL || "http://localhost:3000",
      },
    },
  ],
};
