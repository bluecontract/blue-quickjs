(() => {
  globalThis.__counter = 0;
  for (let i = 0; i < 3; i++) {
    __counter++;
  }
  return __counter;
})();
