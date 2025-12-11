(() => {
  globalThis.__filterCount = 0;
  [1, 2, 3, 4, 5].filter((v) => {
    __filterCount++;
    return v % 2;
  });
  return __filterCount;
})();
