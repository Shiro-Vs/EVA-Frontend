/** Reglas de la contraseña nueva (las mismas del registro): al menos 8 caracteres, una mayúscula y un número. Devuelve el mensaje o "". */
export function passwordProblem(password: string): string {
  if (password.length < 8) return "Mínimo 8 caracteres";
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return "Usa una mayúscula y un número";
  return "";
}
