It's common to encounter unhelpful stack traces in Node.js, especially when doing asynchrnous work. These stack traces can hide the originating context or any useful content at all.


The file `badserver.js` sends garbage to a node http request client. The stack trace doesn't indicate any location information outside of Node.js core that the programmer can use to trace to their code:
```
$ node badserver.js
{ [Error: Parse Error] bytesParsed: 0, code: 'HPE_INVALID_CONSTANT' }
Error: Parse Error
    at Error (native)
    at Socket.socketOnData (_http_client.js:305:20)
    at emitOne (events.js:77:13)
    at Socket.emit (events.js:169:7)
    at readableAddChunk (_stream_readable.js:146:16)
    at Socket.Readable.push (_stream_readable.js:110:10)
    at TCP.onread (net.js:523:20)
```

This version of the previous example removes the `on('error')` handler, resulting in an equally unhelpful but different stack trace:
```
$ node badserver_nohandler.js
events.js:141
      throw er; // Unhandled 'error' event
      ^

Error: Parse Error
    at Error (native)
    at Socket.socketOnData (_http_client.js:305:20)
    at emitOne (events.js:77:13)
    at Socket.emit (events.js:169:7)
    at readableAddChunk (_stream_readable.js:146:16)
    at Socket.Readable.push (_stream_readable.js:110:10)
    at TCP.onread (net.js:523:20)
```

Relying on the uncaughtException handler does not give us any more context or identify that it was through the uncaughtException handler:
```
$ node badserver_uncaughthandler.js
{ [Error: Parse Error] bytesParsed: 0, code: 'HPE_INVALID_CONSTANT' }
Error: Parse Error
    at Error (native)
    at Socket.socketOnData (_http_client.js:305:20)
    at emitOne (events.js:77:13)
    at Socket.emit (events.js:169:7)
    at readableAddChunk (_stream_readable.js:146:16)
    at Socket.Readable.push (_stream_readable.js:110:10)
    at TCP.onread (net.js:523:20)
{ [Error: socket hang up] code: 'ECONNRESET' }
Error: socket hang up
    at createHangUpError (_http_client.js:203:15)
    at Socket.socketCloseListener (_http_client.js:235:23)
    at emitOne (events.js:82:20)
    at Socket.emit (events.js:169:7)
    at TCP._onclose (net.js:469:12)
```

Rethrowing hides the original error and the context of the original error:
```
$ node rethrow.js
/home/bryce/forks/nodejs-symposiums/Round2/async-errors/rethrow.js:11
  throw new Error('saw an error!')
  ^

Error: saw an error!
    at ClientRequest.<anonymous> (/home/bryce/forks/nodejs-symposiums/Round2/async-errors/rethrow.js:11:9)
    at emitOne (events.js:77:13)
    at ClientRequest.emit (events.js:169:7)
    at Socket.socketOnData (_http_client.js:310:9)
    at emitOne (events.js:77:13)
    at Socket.emit (events.js:169:7)
    at readableAddChunk (_stream_readable.js:146:16)
    at Socket.Readable.push (_stream_readable.js:110:10)
    at TCP.onread (net.js:523:20)
```

This example has a user throwing an exception in an asynchronous continuation, which shows some of the context (the throwing site) but not the originating context:
```
$ node usererror.js
/home/bryce/forks/nodejs-symposiums/Round2/async-errors/usererror.js:10
      throw new Error('intentional throw')
      ^

Error: intentional throw
    at IncomingMessage.<anonymous> (/home/bryce/forks/nodejs-symposiums/Round2/async-errors/usererror.js:10:13)
    at emitOne (events.js:77:13)
    at IncomingMessage.emit (events.js:169:7)
    at IncomingMessage.Readable.read (_stream_readable.js:360:10)
    at flow (_stream_readable.js:743:26)
    at resume_ (_stream_readable.js:723:3)
    at doNTCallback2 (node.js:441:9)
    at process._tickCallback (node.js:355:17)
```

Non-sequitor: this error makes us sad:
```
$ node -p 'require("fs").openSync("foo")'
fs.js:549
  return binding.open(pathModule._makeLong(path), stringToFlags(flags), mode);
                 ^

TypeError: flags must be an int
    at TypeError (native)
    at Object.fs.openSync (fs.js:549:18)
    at [eval]:1:15
    at Object.exports.runInThisContext (vm.js:54:17)
    at Object.<anonymous> ([eval]-wrapper:6:22)
    at Module._compile (module.js:435:26)
    at node.js:578:27
    at doNTCallback0 (node.js:419:9)
    at process._tickCallback (node.js:348:13)
```

Asynchronous operation resource cleanup: business rule: "write the same content to two files" one file succeeded, the other failed, need full context to know to clean up the succeded write or clean up the failed write. Stack trace also terrible:
```
$ node cleanup.js
events.js:141
      throw er; // Unhandled 'error' event
      ^

Error: EACCES: permission denied, open './fileB'
    at Error (native)
bryce@x1c:~/forks/nodejs-symposiums/Round2/async-errors$ wc -c file*
6 fileA
0 fileB
6 total
```

`Error.captureStackTrace` can hide detail when provided with a custom constructor:
```
$ node  -p 'var m={};Error.captureStackTrace(m);console.log(m.stack)'
Error
    at [eval]:1:16
    at Object.exports.runInThisContext (vm.js:54:17)
    at Object.<anonymous> ([eval]-wrapper:6:22)
    at Module._compile (module.js:435:26)
    at node.js:578:27
    at doNTCallback0 (node.js:419:9)
    at process._tickCallback (node.js:348:13)
undefined
bryce@x1c:~/forks/nodejs-symposiums/Round2/async-errors$ node  -p 'var m={};Error.captureStackTrace(m,module._compile);console.log(m.stack)'
Error
    at node.js:578:27
    at doNTCallback0 (node.js:419:9)
    at process._tickCallback (node.js:348:13)
undefined
```

Some errors provide their own "context" but it doesn't relate to the calling code at all. This error is hiding a coding error that is misusing the Buffer API. Good luck with this one in your logs:
```
$ node jsonerror.js
undefined:1



SyntaxError: Unexpected token
```
