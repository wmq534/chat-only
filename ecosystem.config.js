// ecosystem.config.js
  module.exports = {
    apps: [{
      name: 'private-chat',
      script: 'server/index.js',
      cwd: '/var/www/private-chat',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }]
  }