const http = require("http")

const goodserver = http.createServer((req, res) => {
  res.end(JSON.stringify({foo: 'bar'}))
}).listen(8000)

function go() {
  const req = http.get({port: 8000}, function (res) {
    var chunks = []
    res.on('data', (chunk) => {
      chunks.push(chunk)
    })
    res.on('end', () => {
      var obj = JSON.parse(Buffer(chunks))
    })
  })
}

setTimeout(go, 10)
