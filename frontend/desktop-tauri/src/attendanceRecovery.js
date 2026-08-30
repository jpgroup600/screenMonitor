export async function restoreAttendanceMonitoring({ request, native, token, policy }) {
  const current = await request.get("/attendance/current");
  await request.post("/session/monitoring/ensure", {});
  if (policy.monitoringEnabled) await native.startAttendanceMonitoring(token, policy);
  else await native.stopMonitoring();
  return current || null;
}
