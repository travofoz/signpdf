module.exports = {
  apps: [{
    name: "signpdf.leadplateau.com",
    cwd: "/var/www/signpdf.leadplateau.com",
    script: "npm",
    args: "start",
    env: {
      PORT: 4567,
      NODE_ENV: "production"
    }
  }]
}
