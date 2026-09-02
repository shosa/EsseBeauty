import { describe, expect, it } from "vitest";

import { createDemoMailto } from "./app/_components/DemoContact";

describe("demo contact email handoff", () => {
  it("composes every supplied contact field into a truthful email request", () => {
    const result = createDemoMailto({
      business: "Luce & Bellezza",
      email: "sofia@example.it",
      message: "Vorrei vedere agenda e magazzino.",
      name: "Sofia Moretti",
      phone: "+39 333 123 4567",
      teamSize: "2–5 persone",
    }, "demo@essebeauty.it");

    expect(decodeURIComponent(result)).toBe("mailto:demo@essebeauty.it?subject=Richiesta demo EsseBeauty — Luce & Bellezza&body=Buongiorno,\n\nVorrei richiedere una demo di EsseBeauty.\n\nNome: Sofia Moretti\nCentro: Luce & Bellezza\nEmail: sofia@example.it\nTelefono: +39 333 123 4567\nTeam: 2–5 persone\n\nMessaggio:\nVorrei vedere agenda e magazzino.");
  });

  it("omits empty optional fields without leaving empty labels", () => {
    const result = decodeURIComponent(createDemoMailto({
      business: "Atelier Rosa",
      email: "ciao@atelier.it",
      message: "",
      name: "Marta",
      phone: "",
      teamSize: "Solo io",
    }, "demo@essebeauty.it"));

    expect(result).not.toContain("Telefono:");
    expect(result).not.toContain("Messaggio:");
    expect(result).toContain("Team: Solo io");
  });
});
