const MyPromise = (() => {
  const PENDING = 'pending',
    FULFILLED = 'fulfilled',
    REJECTED = 'rejected',
    promiseValue = Symbol('promiseValue'),
    promiseStatus = Symbol('promiseStatus'),
    thenables = Symbol('thenables'),
    catchables = Symbol('catchables'),
    changeStatus = Symbol('changeStatus'),
    settleHandle = Symbol('settleHandle'), // 处理后续状态的函数
    linkPromise = Symbol('linkPromise'); // 实现链式操作
  return class {
    /**
     * 改变状态的函数，并同时执行队列里面的函数。
     * @param {*} newStatus 新的状态
     * @param {*} newValue 新的值
     * @param {*} queue 要执行的队列里面的函数
     */
    [changeStatus](newStatus, newValue, queue) {
      if (this[promiseStatus] === PENDING) {
        this[promiseStatus] = newStatus;
        this[promiseValue] = newValue;
        queue.forEach(item => {
          item(newValue);
        });
      }
    }
    /**
     * 初始化一个promise对象。只会执行executor函数，
     * 在executor这个函数里面
     * @param {*} executor
     */
    constructor(executor) {
      this[promiseValue] = undefined;
      this[promiseStatus] = PENDING;
      this[thenables] = [];
      this[catchables] = [];
      const resolve = data => {
        this[changeStatus](FULFILLED, data, this[thenables]);
      };
      const reject = reason => {
        this[changeStatus](REJECTED, reason, this[catchables]);
      };

      try {
        executor(resolve, reject);
      } catch (error) {
        reject(error);
      }
    }
    /**
     * 根据传入的状态，与当前的状态比较，就执行处理函数。
     * @param {*} handler 状态处理函数
     * @param {*} immediatelyStatus 这个状态处理函数执行对应的状态
     * @param {*} queue 相应的队列
     */
    [settleHandle](handler, immediatelyStatus, queue) {
      if (typeof handler !== 'function') {
        return;
      }
      if (this[promiseStatus] == immediatelyStatus) {
        setTimeout(() => {
          handler(this[promiseValue]);
        }, 0);
      } else {
        queue.push(handler);
      }
    }
    /**
     * 用于then或catch返回的promise，用与链式操作。
     * 参数的执行的返回结果决定，链式promise的值。谁执行决定状态。
     * @param {*} thenable then或catch的成功处理函数
     * @param {*} catchable then或catch的失败处理函数
     */
    [linkPromise](thenable, catchable) {
      /**
       * 用于执行then对应的参数函数
       * @param {*} data 传过来的参数，也就是当前的promise 的值
       * @param {*} handler 这个promise处理函数
       * @param {*} resolve 新的promise的resolve
       * @param {*} reject 新的promsie 的reject
       */
      function exec(data, handler, resolve, reject) {
        try {
          const result = handler(data);
          if (result instanceof MyPromise) {
            // 如果是promise，就看返回的promise的状态（外界调用resolve或者reject方法）是什么，
            // 成功就是链式的成功， 失败就是链式的失败。
            result.then(
              res => resolve(res),
              err => reject(err),
            );
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
      }

      return new MyPromise((resolve, reject) => {
        // 因为我们要知道thenable或者catchable什么时候执行。好改变promise的状态。
        //  处理外界的promise成功的，与下面的只会有一个执行。因为只有一个状态与之对应。
        this[settleHandle](
          data => {
            // 这里用setTimeout是因为，要等之前的所有的promise处理完成之后，
            // 才执行改变新的priomise的状态。不然就是一条链执行完成后，才会执行另一条链
            setTimeout(() => {
              if (typeof thenable !== 'function') {
                // 父级没有注册thenable函数,就交给自己thenable处理。
                resolve(data);
                return;
              }
              exec(data, thenable, resolve, reject); // 执行成功的函数，并改变新promise状态。
            });
          },
          FULFILLED,
          this[thenables],
        );
        //  处理外界的promise的失败的
        this[settleHandle](
          reason => {
            setTimeout(() => {
              if (typeof catchable !== 'function') {
                reject(reason);
                return;
              }
              exec(reason, catchable, resolve, reject);
            });
          },
          REJECTED,
          this[catchables],
        );
      });
    }
    /**
     * then方法就是传入的函数，用于处理不同的状态
     * @param {*} thenable 处理FULFILLED状态的函数。可能为undefeated。这样状态到的时候，没有相应的函数执行。会报错。接下来的promise的状态就强行是rejected
     * @param {*} catchable 处理REJECTED状态的函数。可能为undefeated
     */
    then(thenable, catchable) {
      return this[linkPromise](thenable, catchable);
    }
    catch(catchable) {
      return this[linkPromise](undefined, catchable); // 去执行相应的状态对应的处理函数
    }
    static all(proms) {
      return new MyPromise((resolve, reject) => {
        const result = proms.map(p => {
          const obj = {
            result: undefined,
            isResolved: false,
          };
          // then里面的函数是异步的
          p.then(
            data => {
              obj.result = data;
              isResolved = true;
              const unResolved = result.filter(r => !r.isResolved);
              if (unResolved.length === 0) {
                resolve(result.map(r => r.result));
              }
            },
            // 有一个失败就全体失败
            reason => {
              reject(reason);
            },
          );
          return obj;
        });
        console.log(result);
      });
    }
    static race(proms) {
      return new MyPromise((resolve, reject) => {
        // 谁先完成或错误就执行。
        proms.forEach(p => {
          p.then(
            data => {
              resolve(data);
            },
            err => {
              reject(err);
            },
          );
        });
      });
    }

    static resolve(data) {
      if (data instanceof MyPromise) {
        return data;
      } else {
        return new MyPromise(resolve => {
          resolve(data);
        });
      }
    }
    static reject(reason) {
      return new MyPromise((resolve, reject) => {
        reject(reason);
      });
    }
  };
})();
