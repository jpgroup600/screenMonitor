#[cfg(windows)]
pub(crate) fn protect(input: &[u8]) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Security::Cryptography::CRYPTPROTECT_UI_FORBIDDEN;
    protect_with_flags(input, CRYPTPROTECT_UI_FORBIDDEN)
}

#[cfg(windows)]
pub(crate) fn protect_machine(input: &[u8]) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::Security::Cryptography::{
        CRYPTPROTECT_LOCAL_MACHINE, CRYPTPROTECT_UI_FORBIDDEN,
    };
    protect_with_flags(
        input,
        CRYPTPROTECT_UI_FORBIDDEN | CRYPTPROTECT_LOCAL_MACHINE,
    )
}

#[cfg(windows)]
fn protect_with_flags(input: &[u8], flags: u32) -> Result<Vec<u8>, String> {
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{CryptProtectData, CRYPT_INTEGER_BLOB},
    };
    let input_blob = CRYPT_INTEGER_BLOB {
        cbData: input.len() as u32,
        pbData: input.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };
    let success = unsafe {
        CryptProtectData(
            &input_blob,
            null(),
            null(),
            null(),
            null(),
            flags,
            &mut output,
        )
    };
    if success == 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    let bytes =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData as *mut core::ffi::c_void) };
    Ok(bytes)
}

#[cfg(windows)]
pub(crate) fn unprotect(input: &[u8]) -> Result<Vec<u8>, String> {
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{
            CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
        },
    };
    let input_blob = CRYPT_INTEGER_BLOB {
        cbData: input.len() as u32,
        pbData: input.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: null_mut(),
    };
    let success = unsafe {
        CryptUnprotectData(
            &input_blob,
            null_mut(),
            null(),
            null(),
            null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if success == 0 {
        return Err(std::io::Error::last_os_error().to_string());
    }
    let bytes =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData as *mut core::ffi::c_void) };
    Ok(bytes)
}

#[cfg(windows)]
pub(crate) fn unprotect_machine(input: &[u8]) -> Result<Vec<u8>, String> {
    unprotect(input)
}

#[cfg(not(windows))]
pub(crate) fn protect(input: &[u8]) -> Result<Vec<u8>, String> {
    Ok(input.to_vec())
}

#[cfg(not(windows))]
pub(crate) fn unprotect(input: &[u8]) -> Result<Vec<u8>, String> {
    Ok(input.to_vec())
}

#[cfg(not(windows))]
pub(crate) fn protect_machine(input: &[u8]) -> Result<Vec<u8>, String> {
    protect(input)
}

#[cfg(not(windows))]
pub(crate) fn unprotect_machine(input: &[u8]) -> Result<Vec<u8>, String> {
    unprotect(input)
}
