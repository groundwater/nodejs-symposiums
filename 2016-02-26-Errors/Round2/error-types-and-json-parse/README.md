# Don't know what throws

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


