const net = require("net")
const crypto = require("crypto")
const http = require("http")

const server = net.createServer((socket) => {
  socket.write(crypto.randomBytes(30))
}).listen(8000)

const req = http.get({port: 8000})
