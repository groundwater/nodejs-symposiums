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
    // programmer assumes there is no mykey/val pairning
  }
  ```
3. the problem, is that `foo.get` can have programmer errors in it, e.g.
  1. The `.get` method could be called incorrectly, e.g. `foo.get(null)`. If we only allow strings as keys, this is different from a `NoValue` error, but rather what should be an assertion error.
  2. The `.get` implementation can have a mistyped variable and throw a `ReferenceError`. The consumers code will assume there is no value for the key, but in reality the API will never return a value.
  3. The `.get` implementation may have a dependency that throws an error. This can occur if a dependency is upgraded transparently becaues of a semver bugfix.
5. If any of the above programmer erorrs occur, `foo.get()` will throw an exception unrelated to `NoValue`.
6. The program calling foo incorrectly assumes the collection has no value for the key passed in,
when in reality the program is silently failing to behave correctly.

In many of the above events, `foo.get()` no longer operates correctly according to its own API.
By catching all thrown errors however, we are masking the misbehavior.

Generally we want the program to terminate immediately, with as much error information available as possible,
so we can correct the problem.

# ES5/6 Compatible Solutions

## "Pattern Matching"

One can "pattern match" on the return value (return null, undefined, or Error in exceptional cases assuming that these are not valid entries in collection).

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
3. DO throw if someone is using your API incorrectly, i.e. "This does not work and will never work"
  Throwing should always result in a change to the code to prevent future errors from being thrown.

## Uh oh, Promises catch everything

Promise issues:
 - promises impose implicit try-catch, result in catching everything as described above
 - general fuckery
 - capable of silently swallowing arbitrary errors
 - This may be avoided using async/await since await converts failed promises to throws
   which would play nicely if we have checked exceptions (see below)

# Possible Modifications to JS

## Error Switching

One solution to the above is to switch on the type of error caugh in your catch statement.
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
1. It's ugly, and i bet you no body will do this.
2. We have unwound the actual stack from the error site to the error handling site.
This prevents post-mortem analysis using core dumps and debugger tools.
  - lose all intermediate arguments used to reach the error condition
  - possibly lose values on the heap that were in play during the error

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


# The story with `JSON.parse`

Problem: Which native JS APIs throw?

```js
JSON.parse(input);
```

Problem: Which node core APIs throw?

```js
fs.readFileSync('foo.md');
```

# If something throws, we don't know if you can try/catch and recover

Problem: we need better core documentation. Which ones are recoverable, which
ones are not?

Node core says: "if core throws, assume you are hosed. abort asap."

# If throw is recoverable, try/catch is too blunt

Problem: Lack of conditional catch means it's possible to catch unexpected
errors in places where you only mean to catch expected errors. That means
try/catch in JS is effectively equivalent to catch throwable.

```js
try {
    var input1,
        input2;

    JSON.parse(input1);
    JSON.pirse(input2);
} catch (e) {
    // e instanceof SyntaxError or TypeError, but what was the cause?
}
```

Reduce the scope of try/catch to only the lines of code that you expect to
throw.

# Conditional catch won't always work

Problem: Even if conditional catch based on error types is supported at a
language level, JS is dynamic, no way to guarantee your condition is valid
until the time you evaluate it.


```js
try {
    x();
    // but inside x(), we set global.Error = {};
    // even if global.Error was not mutated, this error object can come from
    // a different context, in which case this condition will also fail.
} catch if (e instanceof Error) {
    // evaluation of this condition happens only when this catch block
    // is invoked. there is no guarantee that this will do what you expect it
    // to do.
}
```

An un-javascript like solution would be to resolve the exception types
*before* the `try` block is entered.

```
try {
  x() // throws FooError
} catch(FooError as e) {
  // only catch FooError (can be decided by VM w/o executing JS)
}
```

# When using try/catch, you can catch things you don't want to catch

Problem: When using third party libraries not owned by you that throws, you may
unintentionally catch errors even the library author did not account for.

```js
try {
    foo();
} catch (e) {
    // author documents TypeError, but what if throws ReferenceError?
    // that's an unexpected scenario and you don't want to catch it.
}
```

# JSON.parse

So many bad things.

# Between errbacks, throw/try/catch, event emitter, it's possible to swallow errors

You can ignore/swallow error objects in errbacks.
You can forget to subscribe to `.on('error', function() { ... })` event.
You can forget to not rethrow.

# Differentiating types of errors

Programmer/Unexpected Errors:
  - TypeError
  - RangeError
  - SyntaxError

Operational/Expected Errors:
  - Timeouts
  - JSON.parse()
  - ECONNREFUSED
  - ENOENT
  - ENOMEM
  - etc.

All programmer errors are automatically thrown, and operational errors are
returned via errbacks. Not handling an operational error makes it a programmer
error, however it is not automatically surfaced.

JSON.parse is bad because it crosses both of these boxes.


