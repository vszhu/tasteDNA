export function ratingToWeight(rating: 1 | 2 | 3 | 4 | 5) {
  return (rating - 3) / 2;
}

export function vectorMagnitude(vector: number[]) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

export function normalizeVector(vector: number[]) {
  const magnitude = vectorMagnitude(vector);
  if (magnitude === 0) return vector.map(() => 0);
  return vector.map((value) => value / magnitude);
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || left.length === 0) return 0;
  const leftMagnitude = vectorMagnitude(left);
  const rightMagnitude = vectorMagnitude(right);
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return left.reduce((sum, value, index) => sum + value * right[index], 0) /
    (leftMagnitude * rightMagnitude);
}
