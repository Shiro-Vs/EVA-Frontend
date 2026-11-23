jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));

import { applyAccountOrder, moveItem } from "../accountOrder";

describe("accountOrder", () => {
  const sample = [
    { id: "a", name: "BBVA" },
    { id: "b", name: "Interbank" },
    { id: "c", name: "BCP" },
    { id: "d", name: "Yape" },
  ];

  test("applyAccountOrder respeta el orden guardado y agrega cuentas nuevas al final", () => {
    const ordered = applyAccountOrder(sample, ["c", "a"]);
    expect(ordered.map((x) => x.id)).toEqual(["c", "a", "b", "d"]);
  });

  test("applyAccountOrder ignora IDs eliminados o inexistentes", () => {
    const ordered = applyAccountOrder(sample, ["ghost", "d", "b"]);
    expect(ordered.map((x) => x.id)).toEqual(["d", "b", "a", "c"]);
  });

  test("moveItem reordena correctamente hacia derecha e izquierda", () => {
    expect(moveItem(sample, 0, 2).map((x) => x.id)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(sample, 3, 1).map((x) => x.id)).toEqual(["a", "d", "b", "c"]);
    expect(moveItem(sample, 1, 1).map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });
});
