module.exports = {
  apps: [{
    name: "signatura.plugpuppy.com",
    cwd: "/var/www/signatura.plugpuppy.com",
    script: "npm",
    args: "start",
    env: {
      PORT: 4567,
      NODE_ENV: "production"
    }
  }]
}
