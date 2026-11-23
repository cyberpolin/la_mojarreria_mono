export function locationsMatch(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  return (
    Math.abs(left.latitude - right.latitude) < 0.0002 &&
    Math.abs(left.longitude - right.longitude) < 0.0002
  );
}
