/**
 * Repositório simples — o módulo unidades usa o helper genérico no controller.
 * Esta interface existe para documentar o contrato esperado do domínio.
 */
import type { Unidade } from "./unidade.entity";

export interface UnidadeRepository {
  list(): Promise<Unidade[]>;
}