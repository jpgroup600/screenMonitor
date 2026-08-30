export async function initializeAuthToken({ native, storage }) {
  const legacy = storage.getItem('token');
  if (legacy) {
    await native.storeAuthToken(legacy);
    storage.removeItem('token');
    return legacy;
  }
  return native.loadAuthToken();
}

export async function saveAuthToken({ native, storage, token }) {
  await native.storeAuthToken(token);
  storage.removeItem('token');
  return token;
}

export async function removeAuthToken({ native, storage }) {
  await native.clearAuthToken();
  storage.removeItem('token');
}
