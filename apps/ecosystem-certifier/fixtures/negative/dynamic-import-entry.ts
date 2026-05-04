export default async () => {
  const loaded = await import('./dynamic-local');
  return loaded.value;
};
