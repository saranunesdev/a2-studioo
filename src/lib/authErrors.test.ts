import { describe, expect, it } from 'vitest';
import { authErrorText } from './authErrors';

describe('mensagens de login', () => {
  it('limite de e-mails vira frase clara com saída', () => {
    expect(authErrorText(new Error('email rate limit exceeded'))).toContain('entre com a sua senha');
    expect(authErrorText(new Error('For security purposes, you can only request this after 42 seconds.'))).toContain('Espere');
  });
  it('senha errada', () => {
    expect(authErrorText(new Error('Invalid login credentials'))).toBe('E-mail ou senha errados.');
  });
  it('erro desconhecido não mostra texto técnico', () => {
    expect(authErrorText(new Error('fetch failed: ECONNRESET'))).toContain('Confira a internet');
  });
});
