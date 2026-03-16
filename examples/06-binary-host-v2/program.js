(() => {
  const payload = Host.v2.document.get('bytes/payload');
  Host.v2.emit(payload);
  let sum = 0;
  for (const byte of payload) {
    sum += byte;
  }
  return {
    length: payload.byteLength,
    first: payload[0],
    last: payload[payload.byteLength - 1],
    sum,
  };
})();
