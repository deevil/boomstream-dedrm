let nextTick = function (fn) {
  setTimeout(fn, 0);
}
if (typeof process != 'undefined' && process && typeof process.nextTick == 'function') {
  // node.js and the like
  nextTick = process.nextTick;
}

function semaphore(capacity) {
  const semaphore = {
    capacity: capacity || 1,
    current: 0,
    queue: [],
    firstHere: false,

    take: function () {
      let isFirst = 0;
      if (semaphore.firstHere === false) {
        semaphore.current++;
        semaphore.firstHere = true;
        isFirst = 1;
      }

      const item = {n: 1};

      if (typeof arguments[0] == 'function') {
        item.task = arguments[0];
      } else {
        item.n = arguments[0];
      }

      if (arguments.length >= 2) {
        if (typeof arguments[1] == 'function') item.task = arguments[1];
        else item.n = arguments[1];
      }

      const task = item.task;
      item.task = function () {
        task(semaphore.leave);
      };

      if (semaphore.current + item.n - isFirst > semaphore.capacity) {
        if (isFirst === 1) {
          semaphore.current--;
          semaphore.firstHere = false;
        }
        return semaphore.queue.push(item);
      }

      semaphore.current += item.n - isFirst;
      item.task(semaphore.leave);
      if (isFirst === 1) semaphore.firstHere = false;
    },

    leave: function (n) {
      n = n || 1;

      semaphore.current -= n;

      if (!semaphore.queue.length) {
        if (semaphore.current < 0) {
          throw new Error('leave called too many times.');
        }

        return;
      }

      var item = semaphore.queue[0];

      if (item.n + semaphore.current > semaphore.capacity) {
        return;
      }

      semaphore.queue.shift();
      semaphore.current += item.n;

      nextTick(item.task);
    },

    available: function (n) {
      n = n || 1;
      return (semaphore.current + n <= semaphore.capacity);
    }
  };

  return semaphore;
}

export default semaphore;