import SparkMD5 from 'spark-md5';

const payload = Host.v1.document.get('text/markdown-case');

export default {
  digest: SparkMD5.hash(payload),
  digestPrefix: SparkMD5.hash(payload).slice(0, 8),
};
