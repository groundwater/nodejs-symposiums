# Don't know what throws

- Which native JS APIs throw?

```js
JSON.parse(input);
```

- Which node core APIs throw?

```js
fs.readFileSync('foo.md') => throws
```

# If something throws, we don't know if you can try/catch/recover

Better core documentation?
Which ones are recoverable, which ones are not?

# If recoverable? try/catch is too blunt/broad

Problem: Lack of conditional catch (i.e., something like checked exception),
it's possible to catch unexpected errors in place where you only mean to catch
expected errors. Because you don't have a compiler, try/catch in JS is catch
throwable, which means everything under the sun is caught.

```js
try {
    var input1,
        input2;

    JSON.parse(input1);
    JSON.pirse(input2);
} catch (e) {
    // e instanceof SyntaxError, but what was the cause?
}
```

Recommendation: Reduce the scope of try/catch to only the lines of code that
you expect to throw.

# Conditional catch is not a solution

Problem: Use conditional catch to catch only things you want. JS is dynamic,
no way to guarantee your condition is valid until the time you evaluate it.

```js
try {
    x();
    // but inside x(), we set global.Error = {};
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

# Problems with throw






# Error responses
