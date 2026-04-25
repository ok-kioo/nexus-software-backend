import { describe, it, expect } from "vitest";
import { AvisoCreateSchema } from "../modules/avisos/dto/aviso.dto";
import { ContatoCreateSchema } from "../modules/contatos/dto/contato.dto";
import { TurmaCreateSchema } from "../modules/turmas/dto/turma.dto";
import { AlertaStatusUpdateSchema } from "../modules/alertas/dto/alerta.dto";

describe("DTOs hardened (trim/max/uuid/enum)", () => {
  it("AvisoCreateSchema rejeita corpo vazio e título acima de 200 chars", () => {
    expect(AvisoCreateSchema.safeParse({ titulo: "ok", corpo: "" }).success).toBe(false);
    expect(AvisoCreateSchema.safeParse({ titulo: "x".repeat(201), corpo: "ok" }).success).toBe(false);
    expect(AvisoCreateSchema.safeParse({ titulo: "  Aviso  ", corpo: "ok" }).data?.titulo).toBe("Aviso");
  });

  it("AvisoCreateSchema valida enum publico_alvo", () => {
    expect(AvisoCreateSchema.safeParse({ titulo: "x", corpo: "y", publico_alvo: "invalido" }).success).toBe(false);
    expect(AvisoCreateSchema.safeParse({ titulo: "x", corpo: "y", publico_alvo: "todos" }).success).toBe(true);
  });

  it("ContatoCreateSchema exige uuid em aluno_id", () => {
    expect(ContatoCreateSchema.safeParse({ aluno_id: "nao-uuid", tipo: "x", descricao: "y" }).success).toBe(false);
  });

  it("TurmaCreateSchema valida capacidade positiva", () => {
    const base = {
      nome_turma: "T1",
      unidade_id: "11111111-1111-4111-8111-111111111111",
      curso_id: "22222222-2222-4222-8222-222222222222",
    };
    expect(TurmaCreateSchema.safeParse({ ...base, capacidade: 0 }).success).toBe(false);
    expect(TurmaCreateSchema.safeParse({ ...base, capacidade: 30 }).success).toBe(true);
  });

  it("AlertaStatusUpdateSchema só aceita status conhecido", () => {
    expect(AlertaStatusUpdateSchema.safeParse({ status: "qualquer" }).success).toBe(false);
    expect(AlertaStatusUpdateSchema.safeParse({ status: "resolvido" }).success).toBe(true);
  });
});
