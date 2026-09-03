export async function headers() {
  return new Headers();
}
export async function cookies() {
  return { getAll: () => [], set: () => {} };
}
