export function locationsMatch(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  return (
    Math.abs(left.latitude - right.latitude) < 0.0002 &&
    Math.abs(left.longitude - right.longitude) < 0.0002
  );
}

export function mockFoundLocation(query: string) {
  const name = query.trim();
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 33 + name.charCodeAt(index)) % 997;
  }
  return {
    name,
    latitude: Number((17.989 + hash / 200000).toFixed(6)),
    longitude: Number((-92.928 - (hash % 80) / 200000).toFixed(6)),
  };
}
