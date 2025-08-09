const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return `${bytes}`;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 2 : 1)} ${units[i]}`;
};

module.exports = { formatBytes };
