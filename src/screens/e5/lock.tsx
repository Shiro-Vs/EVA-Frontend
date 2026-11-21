import React, { useEffect, useState } from "react";
import { Button, Card, Field, Notice, Screen, SwitchRow, Txt } from "../../components/v1/ui";
import { useSubmit } from "../../hooks/useAsync";
import { isValidPin, isWeakPin, PIN_LENGTH } from "../../security/lock";
import { useLock } from "../../security/LockGate";
import { biometricEnabled, biometricSupported, clearLock, lockAvailable, setBiometricEnabled, setPin, verifyPin } from "../../security/store";

/** PIN y huella de este teléfono. Se guardan solo aquí (hash con sal en el almacenamiento seguro). */
export function LockSettingsScreen() {
  const { enabled, refresh } = useLock();
  const [pin, setP] = useState("");
  const [again, setAgain] = useState("");
  const [current, setCurrent] = useState("");
  const [bio, setBio] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { biometricEnabled().then(setBio).catch(() => {}); biometricSupported().then(setBioOk).catch(() => {}); }, [enabled]);

  const pinProblem = pin.length === 0 ? null : !isValidPin(pin) ? `Debe tener ${PIN_LENGTH} dígitos` : isWeakPin(pin) ? "Elige un PIN menos obvio" : null;
  const mismatchProblem = again.length > 0 && pin !== again ? "Los PIN no coinciden" : null;
  const save = useSubmit(async () => {
    if (enabled) {
      const v = await verifyPin(current);
      if (!v.ok) throw new Error(v.waitSeconds > 0 ? `Espera ${v.waitSeconds} s para volver a intentar.` : "El PIN actual no es correcto.");
    }
    await setPin(pin);
    setP(""); setAgain(""); setCurrent(""); setMsg(enabled ? "PIN cambiado." : "Bloqueo activado.");
    await refresh();
  });
  const off = useSubmit(async () => {
    const v = await verifyPin(current);
    if (!v.ok) throw new Error(v.waitSeconds > 0 ? `Espera ${v.waitSeconds} s para volver a intentar.` : "El PIN actual no es correcto.");
    await clearLock(); setCurrent(""); setMsg("Bloqueo desactivado."); await refresh();
  });

  if (!lockAvailable()) return <Screen title="PIN y huella"><Notice tone="info">El bloqueo solo está disponible en la app instalada en el teléfono.</Notice></Screen>;
  const ready = isValidPin(pin) && !isWeakPin(pin) && pin === again && (!enabled || isValidPin(current));
  return (
    <Screen title="PIN y huella" subtitle={enabled ? "Bloqueo activado en este teléfono" : "Sin bloqueo en este teléfono"}>
      <Card>
        {enabled && <Field label="PIN actual" value={current} onChangeText={(v) => setCurrent(v.replace(/\D/g, "").slice(0, PIN_LENGTH))} secureTextEntry keyboardType="number-pad" />}
        <Field label={enabled ? "PIN nuevo" : `Crea un PIN de ${PIN_LENGTH} dígitos`} value={pin} onChangeText={(v) => { setP(v.replace(/\D/g, "").slice(0, PIN_LENGTH)); setMsg(null); }} secureTextEntry keyboardType="number-pad" error={pinProblem ?? undefined} />
        <Field label="Repite el PIN" value={again} onChangeText={(v) => setAgain(v.replace(/\D/g, "").slice(0, PIN_LENGTH))} secureTextEntry keyboardType="number-pad" error={mismatchProblem ?? undefined} />
        <Button title={enabled ? "Cambiar PIN" : "Activar bloqueo"} busy={save.busy} disabled={!ready} onPress={save.submit} />
      </Card>
      {enabled && bioOk && (
        <Card>
          <SwitchRow label="Desbloquear con huella o rostro" hint="El PIN siempre queda como respaldo" value={bio} onValueChange={(v) => { setBio(v); setBiometricEnabled(v).catch(() => {}); }} />
        </Card>
      )}
      {enabled && (
        <Card outlined>
          <Txt size={13} muted>Para quitar el bloqueo escribe tu PIN actual arriba.</Txt>
          <Button title="Desactivar bloqueo" variant="danger" busy={off.busy} disabled={!isValidPin(current)} onPress={off.submit} />
        </Card>
      )}
      {msg && <Notice tone="ok">{msg}</Notice>}
      {(save.error || off.error) && <Notice tone="err">{save.error ?? off.error}</Notice>}
      <Notice tone="info">Si olvidas el PIN, puedes cerrar sesión desde la pantalla de bloqueo y volver a entrar con tu cuenta.</Notice>
    </Screen>
  );
}
