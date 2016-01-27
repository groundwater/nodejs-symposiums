const http = require("http")

const goodserver = http.createServer((req, res) => {
  res.end('bye\n')
}).listen(8000)

function go() {
  const req = http.get({port: 8000}, function (res) {
    res.on('data', (chunk) => {
      throw new Error('intentional throw')
    })
    res.on('end', console.log)
  })
}

setTimeout(go, 10)
