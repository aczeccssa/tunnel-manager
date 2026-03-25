import { invoke } from "@tauri-apps/api/core";

// Keychain operations via Tauri commands
export async function storePassword(
  service: string,
  account: string,
  password: string
): Promise<void> {
  await invoke("store_keychain", { service, account, password });
}

export async function retrievePassword(
  service: string,
  account: string
): Promise<string | null> {
  return await invoke("retrieve_keychain", { service, account });
}

export async function deletePassword(
  service: string,
  account: string
): Promise<void> {
  await invoke("delete_keychain", { service, account });
}

export function makeKeychainService(profileId: string): string {
  return `tunnel-manager.${profileId}`;
}

export function makeKeychainAccount(
  field: "password" | "passphrase",
  profileId: string
): string {
  return `${field}.${profileId}`;
}
