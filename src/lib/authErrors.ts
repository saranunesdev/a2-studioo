/** Traduz os erros de login do Supabase para frases curtas em português. */
export function authErrorText(e: unknown): string {
  const m = (e instanceof Error ? e.message : String(e || '')).toLowerCase();
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes'))
    return 'Muitos e-mails de login em pouco tempo. Espere cerca de 1 hora, ou entre com a sua senha.';
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'E-mail ou senha errados.';
  if (m.includes('email not confirmed')) return 'Confirme o seu e-mail antes de entrar.';
  if (m.includes('password should be') || m.includes('weak')) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (m.includes('same') && m.includes('password')) return 'A senha nova precisa ser diferente da atual.';
  if (m.includes('signups not allowed') || m.includes('not allowed')) return 'Este e-mail não tem acesso à gestão.';
  return 'Não deu para entrar. Confira a internet e tente de novo.';
}
