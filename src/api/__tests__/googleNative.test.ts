import { nativeGoogleAvailable, nativeGoogleIdToken, NO_NATIVE } from "../googleNative";

const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; });

describe("Google nativo", () => {
  it("sin el ID de cliente web no está disponible (se usa el navegador)", () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    expect(nativeGoogleAvailable()).toBe(false);
  });

  it("sin el ID de cliente web, pedir el token avisa que no hay módulo nativo utilizable", async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    await expect(nativeGoogleIdToken()).rejects.toThrow(NO_NATIVE);
  });
});
