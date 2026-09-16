export const REGRAS_SENHA = [
  { texto: "Pelo menos 10 caracteres", ok: (s: string) => s.length >= 10 },
  { texto: "Uma letra maiúscula", ok: (s: string) => /[A-Z]/.test(s) },
  { texto: "Uma letra minúscula", ok: (s: string) => /[a-z]/.test(s) },
  { texto: "Um número", ok: (s: string) => /[0-9]/.test(s) },
  {
    texto: "Um caractere especial (!@#$%...)",
    ok: (s: string) => /[^A-Za-z0-9]/.test(s),
  },
  {
    texto: "Sem sequências óbvias (123456, senha, qwerty)",
    ok: (s: string) =>
      !/(123456|654321|abcdef|qwerty|senha|password|admin)/i.test(s) &&
      !/^(.)\1+$/.test(s),
  },
] as const;

export const MIN_SENHA = 10;

export function senhaValida(senha: string) {
  return REGRAS_SENHA.every((r) => r.ok(senha));
}

export function primeiroErroSenha(senha: string) {
  return REGRAS_SENHA.find((r) => !r.ok(senha))?.texto ?? null;
}
