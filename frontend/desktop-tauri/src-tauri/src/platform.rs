#[cfg(windows)]
pub fn active_application() -> String {
    use std::path::Path;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };

    unsafe {
        let window = GetForegroundWindow();
        if window.is_null() {
            return "unknown".into();
        }
        let mut pid = 0;
        GetWindowThreadProcessId(window, &mut pid);
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return "unknown".into();
        }
        let mut buffer = vec![0u16; 1024];
        let mut size = buffer.len() as u32;
        let ok = QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut size);
        CloseHandle(process);
        if ok == 0 {
            return "unknown".into();
        }
        let path = String::from_utf16_lossy(&buffer[..size as usize]);
        Path::new(&path)
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("unknown")
            .to_owned()
    }
}

#[cfg(not(windows))]
pub fn active_application() -> String {
    "unknown".into()
}

#[cfg(windows)]
pub fn idle_seconds() -> u32 {
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    unsafe {
        let mut info = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut info) == 0 {
            0
        } else {
            GetTickCount().wrapping_sub(info.dwTime) / 1000
        }
    }
}

#[cfg(windows)]
pub fn removable_drives() -> Vec<String> {
    use windows_sys::Win32::Storage::FileSystem::{GetDriveTypeW, GetLogicalDrives};
    use windows_sys::Win32::System::WindowsProgramming::DRIVE_REMOVABLE;
    let drives = unsafe { GetLogicalDrives() };
    (0..26)
        .filter_map(|index| {
            if drives & (1 << index) == 0 {
                return None;
            }
            let letter = (b'A' + index as u8) as char;
            let root = format!("{letter}:\\");
            let wide = root
                .encode_utf16()
                .chain(std::iter::once(0))
                .collect::<Vec<_>>();
            (unsafe { GetDriveTypeW(wide.as_ptr()) } == DRIVE_REMOVABLE).then_some(root)
        })
        .collect()
}

#[cfg(not(windows))]
pub fn removable_drives() -> Vec<String> {
    Vec::new()
}

#[cfg(not(windows))]
pub fn idle_seconds() -> u32 {
    0
}
