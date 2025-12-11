(() => {
  globalThis.__reduceCount = 0;
  return [1, 2, 3, 4, 5].reduce((acc, v) => {
    __reduceCount++;
    return acc + v;
  }, 0);
})();
