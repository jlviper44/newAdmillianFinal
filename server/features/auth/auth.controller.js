import { handleAuth as handleAuthLegacy, initializeAuthTables } from '../../Auth/Auth.js';

export async function handleAuth(request, env) {
  const url = new URL(request.url);
  console.log('[AUTH CONTROLLER] Handling:', url.pathname);
  await initializeAuthTables(env);
  const result = await handleAuthLegacy(request, env);
  console.log('[AUTH CONTROLLER] Result:', result ? 'Response' : 'null');
  return result;
}