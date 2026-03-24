export function createConsumerHost() {
  const emitted = [];
  return {
    emitted,
    handlers: {
      document: {
        get(path) {
          switch (path) {
            case 'consumer/version':
              return { ok: '1.2.3', units: 1 };
            case 'consumer/encoded':
              return { ok: '&lt;b&gt;deterministic&lt;/b&gt;', units: 1 };
            case 'consumer/route':
              return { ok: '/contract/:id/release/:version', units: 1 };
            default:
              return {
                err: { code: 'NOT_FOUND', tag: 'host/not_found' },
                units: 1,
              };
          }
        },
        getCanonical(path) {
          return this.get(path);
        },
      },
      emit(value) {
        emitted.push(value);
        return { ok: null, units: 1 };
      },
    },
  };
}
