# Problem Outline

We will attempt to show the problems with using `throw/catch` as an API,
and to make the argument that one should _never_ force a consumer to use `try/catch`.

Let us start with an example API that forces a user to use a `try/catch` block.

1. Assume we have a collection object `foo` with a `.get(key)` method.
  1. If `key` exists, return the associated value.
  2. If `key` does not exist, throw a `NoValue` error.
  3. note there is no other way to check if they key exists or not.
2. The consumer is forced to use `try/catch` e.g.

  ```js
  try {
    var val = foo.get('mykey')
    // val exists and was part of the collection
  } catch(err) {
    // programmer assumes there is no mykey/val pairing
  }
  ```
3. the problem, is that `foo.get` can have programmer errors in it, e.g.
  1. The `.get` method could be called incorrectly, e.g. `foo.get(null)`. If we only allow strings as keys, this is different from a `NoValue` error, but rather what should be an assertion error.
  2. The `.get` implementation can have a mistyped variable and throw a `ReferenceError`. The consumers' code will assume there is no value for the key, but in reality the API will never return a value.
  3. The `.get` implementation may have a dependency that throws an error. This can occur if a dependency is upgraded transparently becaues of a semver bugfix.
5. If any of the above programmer erorrs occur, `foo.get()` will throw an exception unrelated to `NoValue`.
6. The program calling `foo` incorrectly assumes the collection has no value for the key passed in,
when in reality the program is silently failing to behave correctly.

In many of the above events, `foo.get()` no longer operates correctly according to its own API.
By catching all thrown errors however, we are masking the misbehavior.

Generally we want the program to terminate immediately, with as much error information available as possible,
so we can correct the problem.

# ES5/6 Compatible Solutions

## Error Switching

One solution to the above is to switch on the type of error caught in your `catch` statement.
This works for errors we wish to handle, but can present problems if you do not wish to handle the error. e.g.

```js
try {
  let val = foo.get()
} catch(err) {
  if (err instanceof NoValue) {
    // handle no value
  } else {
    throw err
  }
}
```

The good

1. Despite rethrowing, `err` still has the correct stack.

The bad

1. Easy to forget to setup the conditional in the catch block, and the additional `throw` is boilerplate.
2. We have unwound the actual stack from the error site to the error handling site.
This prevents post-mortem analysis using core dumps and debugger tools.
  - lose all intermediate arguments used to reach the error condition
  - possibly modified values on the heap that were in play during the error

## "Pattern Matching"

One can "pattern match" on the return value (return `null`, `undefined`, or `Error` in exceptional cases assuming that these are not valid entries in collection).

```js
var val = foo.get(...)
if (val instanceof NoValue) {
  // no value returned
} else {
  // we have a value!
}
```

Note that this will let any thrown error terminate the program without unwinding the stack!

## Callbacks / Errorbacks

Even for a synchronous API, allow a callback that takes an `(error, value)` pair. e.g.

```js
foo.get(key, (err, val) => {
  if (err) {
    // no value
  } else {
    // value
  }
})
```

One should _probably_ invoke the callback asynchronously to avoid confusing.

# What we learned

In order to minimize your program operating in an unknown state:

1. As part of your own APIs, do not force users to catch, throwing should always terminate the program.
2. For legacy APIs like `JSON.parse` keep the try block to a minimum e.g.
  ```js
  var data
  try {
    data = JSON.parse(...)
  } catch (e) {
    data = null
    // or ignore this
  }
  ```
  - Perhaps node core can provide a safe wrapper for this, e.g. `util.parse` that throws if called with a non-string, but returns `null` or `undefined` when called with a non parsable string.
3. One *may* throw if someone is using your API incorrectly, i.e. "This does not work and will never work"
  Throwing should always result in a change to the code to prevent future errors from being thrown.

## Uh oh, Promises catch everything

Promise issues:
 - promises impose implicit try-catch, result in catching everything as described above
 - capable of silently swallowing arbitrary errors
 - async/await turns rejected promises into throws
 - if people use rejected promises for operational errors, we are forced to use catch blocks

The implication here is that *any* rejected promise should terminate the program.
On the server, this should crash the process and optionally produce a core dump.
On the browser, at the very least developers should be able to use debugging tools to break at the site of the rejection.

# Possible Modifications to JS

## Introduce typed error catching / Checked Exceptions

We can integrate the idea of switching against returned errors directly into the language.

1. Evaluate expression before catch block is entered to determine whether the error
   is best handled at this location.

```js
try {
  let val = foo.get()
} catch(e if e instanceof NoValue) {
  // e is the error we expect
}
```

or more generally

```js
try {
  //
} catch(e if <expr>) {
  // ...
} catch(e if <expr>) {
  // ...
}
```

The good:

 - Follows "JS way" of using expressions.
 - Allows multiple independent `catch` blocks for different error cases.

The bad:

 - Need to unwind the stack to the catch handler location to evaluate `<expr>`.
 - Unexpected side effects in `<expr>` can lead to scary program behavior
 - How do we handle complex cases like `<expr> ::= (function() { throw 'hi'; })();`

We can eliminate the _bad_ in the above solutions by knowing the conditions of the catch blocks _before_ entering the try block.
For example, allowing for typescript-style type annotation:

```js
try {
  let val = foo.get()
} catch(e : NoValue) {
  // e has type NoValue
}
```

The good

- all of the above
- The VM can decide if the exception is catchable _before_ unwinding the stack.

The bad

- No language type support yet.

Open Questions:

 - Is there a separate typing environment for looking up things on rhs of :
    - This is the case for typescript
 - Allow anything other than type literal (type name), maybe expression evaluating to a type?

## Checked/Unchecked Errors

> the following comes from a discussion between @groundwater and @chrisdickinson

Introduce the concept of an *Unchecked* Error, where only *Checked* Errors are caught by Promises, and possibly try/catch blocks.

### Use an Error hierarchy to indicate Checked/Unchecked

We choose to borrow a few concepts from Java. Java has a very well thought out exception handling system, including the concept of *Checked* and *Unchecked* exceptions. In short, Checked exceptions must be handled, whereas Unchecked exceptions are generally not handled. Throwing an Unchecked exception generally indicates a programmer error, and the program will not work. In most cases, the program terminates and a post-mortem process can investigate why the error occurred.

In JavaScript one could create a top-level name `UncheckedError` that when thrown bypasses the default `catch` clause. Libraries can use `UncheckedError`s to differentiate between operational errors, like a network socket closing, and programmer errors like calling a function with too few arguments.

In addition, one could allow applications to choose whether `ReferenceError`, `TypeError`, and other built in errors inherit from `Error` or `UncheckedError`. Perhaps even by varying this behavior between production and development. It would be our recommendation to always inherit builtin errors from `UncheckedError` but it's easy to allow both.

e.g.

```js
// optionally Unchecked
try {
  console.log(someUndefinedVariable)
} catch (e) {
  // never called
}

// explicit
try {
  throw new UncheckedError('this will not be caught')
} catch (e) {
  // never called
}
```

Pros

1. allows developers to use `try/catch` without worrying about catching programmer errors
2. minimal language changes
3. developers can opt into strict or non-strict error behavior

Cons

1. may confuse developers who are unclear why `catch` isn't working
2. developers may want to just catch everything, do we allow an explicit catch block for this?

This could be forward compatible with a typed exceptions proposal, e.g. `catch(e: UncheckedError) {...}`

### Use a new keyword instead of `throw`

For example instead of `throw` we could introduce the `panic` keyword, which is not processed by exception handlers.

```js
panic new Error("something bad")
```

Pros

1. does not introduce uncatchable exceptions
2. explicit!

Cons

1. introduces top level non-reserved keyword, likely not backward compatible
2. unclear if we should introduce a complimentary *recover*
3. does not handle existing exceptions like `ReferenceError` unless a switch exists to turn these types of errors into panics

## The Recovery Method

@zkat brought up another alternative for handling operational errors that seems compelling to me — specifying a condition/recovery object on async calls to "expect" and handle certain states. In practice, it might look something like this:

```javascript
const result = fs.readFilePromise('some/file', 'utf8', {
  ENOENT() {
    return null
  },
  EISDIR() {
    return fs.readFilePromise('some/other/file', 'utf8')
  }
})
```

* The `recovery` object would be an optional terminal parameter that would enumerate expected operational errors.
* A `handler` would map an error state (`EISDIR`) to a function.
* The return value of the `handler` would be `Promise.resolve`'d, so a `handler` could perform asynchronous tasks in order to recover from an operation.
* The resolution value of the `handler` would be used as the resolution value of the outer promise.
  * If the `handler` for an operational error rejects or throws, that exception will be propagated to the outside promise.
  * If the `recovery` object isn't present, or no `handler` is specified for an operational error, the returned promise will be rejected with that error.
* The presence of a `handler` would be determined in a regular fashion across all Node APIs, looking up `recovery[err.code]`.
* `handler`'s fire at the top of stack — so if one hit a truly exceptional situation in a `handler`, `process.abort()` should contain relevant information.

Some examples:

```javascript
// recovery not present
fs.readFilePromise('dne').catch(err => { /* ENOENT */ })

// recovery present, no handler
fs.readFilePromise('dne', {EISDIR() {}}).catch(err => { /* ENOENT */ })

// recovery present, handler throws
fs.readFilePromise('dne', {ENOENT() { throw new Error('oh no') }}).catch(err => { /* 'oh no' */ })

// recovery present, handler rejects
fs.readFilePromise('dne', {ENOENT() { return fs.readFilePromise('stilldne') }}).catch(err => { /* ENOENT */ })

// recovery present, handler resolves
fs.readFilePromise('dne', {ENOENT() { return fs.readFilePromise('exists!') }}).then(data => { /* yay! */ })

// recovery present, immediate value
fs.readFilePromise('dne', {ENOENT() { return null }}).then(data => { if (data) { /* yay! */ } })

// using async/await, avoiding exceptional flow control:
const data = await fs.readFilePromise(maybeDNE, {ENOENT() { return null }})
if (data === null) {
  return
}

// using async/await, preferring exceptional flow control:
try {
  const data = await fs.readFilePromise(maybeDNE)
} catch (err) {
  return
}
```

@benjamingr [offers an alternative API](https://github.com/groundwater/nodejs-symposiums/pull/6#issuecomment-184120276) using a `.recover()` method attached to the Promise API.

## Cancellable Promises

*WIP*
