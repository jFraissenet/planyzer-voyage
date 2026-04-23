import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "planyzer:pending_invite";

export async function setPendingInvite(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, token);
  } catch {
    // ignore
  }
}

export async function consumePendingInvite(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) await AsyncStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}

export async function peekPendingInvite(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}
