const target = { value: 1 };
const proxy = new Proxy(target, {
  get(obj, prop) {
    return obj[prop];
  },
});

export default proxy.value;
