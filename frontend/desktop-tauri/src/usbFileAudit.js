const signature = (file) => `${file.sizeBytes ?? file.size_bytes}:${file.modifiedUnixSeconds ?? file.modified_unix_seconds ?? ""}`;

export function diffUsbFiles(previous, current) {
  if (!previous) return [];
  const before = new Map(previous.map((file) => [file.path, signature(file)]));
  return current.filter((file) => !before.has(file.path) || before.get(file.path) !== signature(file));
}

export async function recordUsbFileCopies({ request, deviceId, drive, files, limit = 100 }) {
  for (const file of files.slice(0, limit)) {
    await request.post("/security-events", {
      deviceId,
      eventType: "FILE_COPY",
      source: file.path,
      details: JSON.stringify({ destinationDrive: drive, sizeBytes: file.sizeBytes ?? file.size_bytes ?? 0 }),
    });
  }
}
