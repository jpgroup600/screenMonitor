export async function restoreAttendanceMonitoring({ request, native, token }) {
  const current = await request.get("/attendance/current");
  await request.post("/session/monitoring/ensure", {});
  await native.startAttendanceMonitoring(token);
  return current || null;
}
