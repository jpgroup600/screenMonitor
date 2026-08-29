export async function restoreAttendanceMonitoring({ request, native, token }) {
  const current = await request.get("/attendance/current");
  if (!current) return null;

  await request.post("/attendance/resume-monitoring", {});
  await native.startAttendanceMonitoring(token);
  return current;
}
