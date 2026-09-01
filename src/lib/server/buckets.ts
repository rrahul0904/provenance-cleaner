export function wordBucketKey(words: number) {
  if (words <= 250) return "w250";
  if (words <= 1_000) return "w1000";
  if (words <= 4_000) return "w4000";
  if (words <= 8_000) return "w8000";
  return "wgt8000";
}

export function fileBucketKey(bytes: number) {
  if (bytes <= 256 * 1024) return "f256k";
  if (bytes <= 1024 * 1024) return "f1m";
  if (bytes <= 2 * 1024 * 1024) return "f2m";
  return "f3_2m";
}
