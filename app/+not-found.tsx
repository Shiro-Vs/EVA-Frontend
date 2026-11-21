import React from "react";
import { useRouter } from "expo-router";
import { Button, Empty, Screen } from "../src/components/v1/ui";

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen title="No encontrado" back={false}>
      <Empty
        icon="compass-outline"
        title="Esta pantalla no existe"
        text="El enlace que abriste no corresponde a ninguna sección de EVA."
        action={<Button title="Volver al inicio" onPress={() => router.replace("/")} />}
      />
    </Screen>
  );
}
