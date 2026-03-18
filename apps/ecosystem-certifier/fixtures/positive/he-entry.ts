import he from 'he';

const encoded = Host.v1.document.get('text/he-case');

export default {
  encoded,
  decoded: he.decode(encoded),
};
