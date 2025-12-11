(() => {
  const part = 'x'.repeat(600000);
  const combined = part + part;
  return combined.length;
})();
