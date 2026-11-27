module.exports = {
  apps: [
    {
      name: 'mailmind-api',
      script: 'index.js',
      instances: 1, // Single instance recommended for embedded SQLite to prevent lock contention
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
