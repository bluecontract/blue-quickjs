(() => {
  globalThis.__calls = 0;
  [1, 2, 3, 4, 5].map((v) => {
    __calls++;
    return v;
  });
  return __calls;
})();
