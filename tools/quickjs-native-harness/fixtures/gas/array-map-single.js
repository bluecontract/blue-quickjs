(() => {
  globalThis.__calls = 0;
  [1].map((v) => {
    __calls++;
    return v;
  });
  return __calls;
})();
