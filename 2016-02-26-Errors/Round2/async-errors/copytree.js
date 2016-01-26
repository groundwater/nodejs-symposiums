// Copy file `source` to `target`
function copyFile(source, target) {
  // This domain does not end up in the parent domain, but in the
  domain.create(function() {
    fs.createReadStream(source).pipe(fs.createWriteStream(target));
  });
}

// domains composability example...
// Copy file `source` to `target`
function copyFile(source, target) {
  // Unless added manually, the created domain does not end up in
  // the caller domain, but rather becomes part of the root domain.
  domain.current.add(domain.create(function() {
    fs.createReadStream(source).pipe(fs.createWriteStream(target));
  }));
}

function copyDirectory(source, target) {
  return fs.readDir(source).then(function (files) {
    return Promise.all(files.map(function (file) {
      return copyFile(
        path.resolve(source, file),
        path.resolve(target, file)
      );
    }));
  });
}

var domain = Domain.create(function() {
  copyDirectory(‘foo’, ‘bar’);
});



// Ideally this would not be necessary at all!
// The domain should just know how to clean up after itself.
domain.on(‘error’, function() {
  // might be called multiple times
  // domain may contain objects that are not disposable
  // domain only captures event emitters
  // should be able to capture all destructibles that were created
  //  in the context of the domain, e.g., file descriptors, references
  //  to remote objects, e.g., database transactions
  domain.dispose();
});




function withLock (db, handle, cb) {
  return new Promise(function (resolve, reject) {
    db.lock(function (err, lock) {
      err ? reject(err) : resolve(lock)
    })
  }).then(function (lock) {
    return handle(lock).then(function (results) {
      return new Promise(function (resolve, reject) {
  lock.unlock(function (err, lock) {
    err ? reject(err) : resolve(lock)
  })
}).then(function () {
  return results
})
    })
  })
}

function batchPutDb (db, list, cb) {
  return new Promise(function (resolve, reject) {
    withLock(db, function (next) {
var promises = list.map(function (item) {
  return new Promise(function (resolve, reject) {
    db.put(item, function (err, res) {
      err ? reject(err) : resolve(res)
    })
  })
})

	return Promise.all(promises)
    }, function (err, res) {
      err ? reject(err) : resolve(res)
    }))
  })
}

