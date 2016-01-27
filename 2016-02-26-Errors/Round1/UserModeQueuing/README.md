### User-mode queueing AKA the pooling problem
## The Problem

The user-mode queuing problem appears when a library/function stores a callback in a global array or object, and invokes it later in a tick which is associated to an unrelated context.

This typically happens in connection pooling libraries and custom schedulers.

There are existing user space modules that provide context propagation for built-in asynchronous primitives. However they can’t make context propagation work for all third-party modules out there. Conversely, third-party modules that implement connection pools or custom schedulers are unlikely to know about or be able to deal with all context propagation libraries. 

Because there’s no commonly agreed on method for context propagation, these libraries that implement connection pools and custom schedulers have no general way to preserve the right context.
Code Example

```javascript
var workQueue = [];

function addWork(work) {
  // addWork() might be invoked from different contexts
  workQueue.push(work);
  if (workQueue.length === 1)
    setTimeout(doWork, 100);
}

function doWork() {
  // However all the work is executed in the context of the first work item.
  var work;
  while (work = workQueue.shift())
    work();
}

addWork(...);
// enter another context
addWork(...)
```

## Possible solutions

1. One specified global variable that all asynchronous functions have to capture and preserve. While correct, this imposes a large code burden on modules using pooling/scheduling in order to restore context at all exit points of the async work.

Example:

```javascript
function addWork(work) {
  var capturedContext = global.context;  
  workQueue.push(function() {
    global.context = capturedContext;
    work();
  });
  if (workQueue.length === 1)
    setTimeout(doWork, 100);
}
```
