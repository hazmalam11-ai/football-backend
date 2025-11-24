module.exports = {
  apps: [{
    name: 'football-backend',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,
    env: {
      NODE_ENV: 'production',
      PORT: 5050,
      NODE_OPTIONS: '--max-old-space-size=1024'
    }
  }]
}
