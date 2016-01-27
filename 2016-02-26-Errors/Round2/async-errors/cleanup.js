const fs = require('fs')

fs.openSync('./fileB', 'w+')
fs.chmodSync('./fileB', 0x111)

function flow() {
  var str = 'hello\n'
  setTimeout(() => {
    var stream1 = fs.createWriteStream('./fileA')
    stream1.write(str)
  }, 50)
  setTimeout(() => {
    var stream2 = fs.createWriteStream('./fileB')
    stream2.write(str)
  }, 80)
}

flow()
