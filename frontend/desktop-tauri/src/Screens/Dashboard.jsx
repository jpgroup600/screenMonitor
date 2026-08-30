import React, { useEffect, useState } from "react";
import { FaClock, FaPlay, FaSignOutAlt, FaStop, FaTachometerAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import request from "../Actions/request";
import { native } from "../native";
import ProjectCard from "../Components/ProjectCard";
import { restoreAttendanceMonitoring } from "../attendanceRecovery";
import { restoreAuthorizedMonitoring, sendDeviceHeartbeat } from "../deviceHeartbeat";
import { diffRemovableDrives, recordUsbChanges } from "../usbAudit";
import { diffUsbFiles, recordUsbFileCopies } from "../usbFileAudit";
import { BACKUP_INITIAL_DELAY_MS, BACKUP_INTERVAL_MS, runBackupCycle, runBackupQueueCycle } from "../backupScheduler";
import { loadDeviceSecurityPolicy, sameDeviceSecurityPolicy } from "../deviceSecurityPolicy";

const Dashboard = () => {
  const [attendance, setAttendance] = useState(null);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [securityPolicy, setSecurityPolicy] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!securityPolicy?.usbAuditEnabled) return undefined;
    const snapshots = new Map();
    const scanUsbFiles = async () => {
      try {
        const drives = await native.listRemovableDrives();
        for (const drive of drives) {
          const current = (await native.previewBackupInventory(drive)).files || [];
          const changed = diffUsbFiles(snapshots.get(drive), current);
          snapshots.set(drive, current);
          await recordUsbFileCopies({ request, deviceId: localStorage.getItem("screenMonitorDeviceId"), drive, files: changed });
        }
        for (const drive of snapshots.keys()) if (!drives.includes(drive)) snapshots.delete(drive);
      } catch (error) {
        console.error("USB file audit failed:", error);
      }
    };
    scanUsbFiles();
    const timer = window.setInterval(scanUsbFiles, 30_000);
    return () => window.clearInterval(timer);
  }, [securityPolicy?.usbAuditEnabled]);

  useEffect(() => {
    if (!securityPolicy?.backupEnabled) return undefined;
    const processQueue = () => runBackupQueueCycle({ native, storage: localStorage }).catch((error) => console.error("Backup queue failed:", error));
    const initial = window.setTimeout(processQueue, 10_000);
    const timer = window.setInterval(processQueue, 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [securityPolicy?.backupEnabled, securityPolicy?.fileChangeAuditEnabled]);

  useEffect(() => {
    if (!securityPolicy?.backupEnabled) return undefined;
    const backup = () => runBackupCycle({ native, storage: localStorage, policy: securityPolicy }).catch((error) => console.error("Incremental backup failed:", error));
    const initial = window.setTimeout(backup, BACKUP_INITIAL_DELAY_MS);
    const timer = window.setInterval(backup, BACKUP_INTERVAL_MS);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [securityPolicy?.backupEnabled]);

  useEffect(() => {
    if (!securityPolicy?.usbAuditEnabled) return undefined;
    let previous = [];
    const scan = async () => {
      try {
        const current = await native.listRemovableDrives();
        const changes = diffRemovableDrives(previous, current);
        previous = current;
        await recordUsbChanges({ request, deviceId: localStorage.getItem("screenMonitorDeviceId"), changes });
      } catch (error) {
        console.error("USB audit failed:", error);
      }
    };
    scan();
    const timer = window.setInterval(scan, 5_000);
    return () => window.clearInterval(timer);
  }, [securityPolicy?.usbAuditEnabled]);

  useEffect(() => {
    const refreshPolicy = async () => {
      try {
        const next = await loadDeviceSecurityPolicy({ request, storage: localStorage });
        setSecurityPolicy((current) => {
          if (sameDeviceSecurityPolicy(current, next)) return current;
          const token = localStorage.getItem('token');
          if (next.monitoringEnabled) native.startAttendanceMonitoring(token, next).catch(console.error);
          else native.stopMonitoring().catch(console.error);
          return next;
        });
      } catch (error) { console.error('Security policy refresh failed:', error); }
    };
    const timer = window.setInterval(refreshPolicy, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const heartbeat = async () => {
      try {
        await sendDeviceHeartbeat({ request, storage: localStorage });
      } catch (error) {
        console.error("Device heartbeat failed:", error);
        if (error?.response?.status === 403) {
          await request.post("/session/monitoring/end", {}).catch(console.error);
          await native.stopMonitoring().catch(console.error);
        }
      }
    };
    const timer = window.setInterval(heartbeat, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;
    request.get(`/project/employee/${userId}/project`)
      .then((items) => setProjects(items || []))
      .catch((err) => console.error("Failed to load assigned projects:", err))
      .finally(() => setProjectsLoading(false));
  }, []);

  useEffect(() => {
    const loadAttendance = async () => {
      try {
        const current = await restoreAuthorizedMonitoring({
          heartbeat: () => sendDeviceHeartbeat({ request, storage: localStorage }),
          restore: async () => {
            const policy = await loadDeviceSecurityPolicy({ request, storage: localStorage });
            setSecurityPolicy(policy);
            return restoreAttendanceMonitoring({ request, native, token: localStorage.getItem("token"), policy });
          },
        });
        setAttendance(current || null);
      } catch (err) {
        console.error("Failed to load attendance:", err);
        if (err?.response?.status === 403) {
          await request.post("/session/monitoring/end", {}).catch(console.error);
          await native.stopMonitoring().catch(console.error);
        }
      } finally {
        setAttendanceLoaded(true);
      }
    };
    loadAttendance();
  }, []);

  useEffect(() => {
    if (!attendanceLoaded || attendance || !securityPolicy?.attendanceRemindersEnabled) return undefined;
    native.startAttendanceReminders().catch(console.error);
    return () => native.stopAttendanceReminders().catch(console.error);
  }, [attendanceLoaded, attendance, securityPolicy?.attendanceRemindersEnabled]);

  const clockIn = async () => {
    try {
      setBusy(true);
      setAttendance(await request.post("/attendance/clock-in", {}));
    } catch (err) {
      console.error(err);
      alert("출근 처리를 완료하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const clockOut = async () => {
    try {
      setBusy(true);
      await request.post("/attendance/clock-out", {});
      setAttendance(null);
    } catch (err) {
      console.error(err);
      alert("퇴근 처리를 완료하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (attendance) await request.post("/attendance/clock-out", {}).catch(console.error);
    await request.post("/session/monitoring/end", {}).catch(console.error);
    await native.stopMonitoring().catch(console.error);
    localStorage.removeItem("userId");
    localStorage.removeItem("token");
    navigate("/");
    window.location.reload();
  };

  const elapsed = (startedAt) => {
    const total = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
    return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  };

  return (
    <div className="w-full h-screen p-8 bg-gray-900 text-white overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-4xl font-bold flex items-center">
            <FaTachometerAlt className="mr-3 text-blue-500" />근무 현황
          </h1>
          <button onClick={logout} className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg">
            <FaSignOutAlt className="mr-2" />로그아웃
          </button>
        </div>

        <section className="rounded-2xl border border-gray-700 bg-gray-800 p-8 shadow-xl">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center text-gray-400">
                <FaClock className="mr-2 text-blue-400" />오늘의 출퇴근
              </div>
              {attendance ? (
                <>
                  <p className="text-sm text-green-400">근무 중</p>
                  <p className="mt-1 font-mono text-5xl font-bold tracking-tight">{elapsed(attendance.clockInAt)}</p>
                  <p className="mt-2 text-sm text-gray-400">
                    출근 {new Date(attendance.clockInAt).toLocaleTimeString()}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400">아직 출근 전입니다.</p>
                  <p className="mt-1 text-3xl font-semibold">출근 준비</p>
                </>
              )}
            </div>

            {attendance ? (
              <button onClick={clockOut} disabled={busy} className="flex items-center justify-center rounded-xl bg-red-600 px-8 py-4 text-lg font-semibold hover:bg-red-700 disabled:opacity-60">
                <FaStop className="mr-3" />퇴근
              </button>
            ) : (
              <button onClick={clockIn} disabled={busy} className="flex items-center justify-center rounded-xl bg-green-600 px-8 py-4 text-lg font-semibold hover:bg-green-700 disabled:opacity-60">
                <FaPlay className="mr-3" />출근 시작
              </button>
            )}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">내 배정 프로젝트</h2>
          </div>
          {projectsLoading ? (
            <p className="text-gray-400">프로젝트를 불러오는 중입니다...</p>
          ) : projects.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => <ProjectCard key={project.id} project={project} readOnly />)}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-400">
              현재 배정된 프로젝트가 없습니다.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
