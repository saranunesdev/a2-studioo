import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field, Logo, useToast } from '../components/ui';
import { setPin, useBackend } from '../store';

/** Tela inicial: escolhe o acesso. Cliente não precisa de login. */
export default function Entrada() {
  const b = useBackend();
  const nav = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<'menu' | 'gestao' | 'atendimento'>('menu');
  const [email, setEmail] = useState('');
  const [pin, setPinV] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  const enterOwner = async () => {
    setErr('');
    if (b.mode === 'supabase' && !/^\S+@\S+\.\S+$/.test(email)) return setErr('Escreva um e-mail válido.');
    try {
      const r = await b.ownerSignIn(email);
      if (r === 'ok') nav('/painel');
      else setSent(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não deu para entrar.');
    }
  };
  const enterDesk = async () => {
    setErr('');
    if (!/^\d{4,8}$/.test(pin)) return setErr('O PIN tem de 4 a 8 números.');
    const ok = await b.checkPin(pin).catch(() => false);
    if (!ok) return setErr('PIN errado. Peça o PIN para a gestão do estúdio.');
    setPin(pin);
    nav('/atendimento');
  };

  return (
    <main className="entry" id="main">
      <div className="box">
        <div>
          <Logo size={260} />
          <p className="eyebrow" style={{ marginTop: 40 }}>Eventos</p>
          <p className="big" style={{ maxWidth: 440 }}>Flash tattoo em eventos: catálogo no QR code, ficha de saúde no celular e fila com aviso na hora.</p>
          <div className="values">
            <div><b>Precisão</b><span className="muted">Cada detalhe importa.</span></div>
            <div><b>Segurança</b><span className="muted">Biossegurança e bem-estar.</span></div>
            <div><b>Excelência</b><span className="muted">Técnica apurada.</span></div>
            <div><b>Autenticidade</b><span className="muted">Arte feita para durar.</span></div>
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {mode === 'menu' && (
            <div className="stack">
              <h1 className="h1">Entrar</h1>
              <button className="btn block lg" onClick={() => setMode('gestao')}>Gestão do estúdio</button>
              <p className="muted" style={{ marginTop: 6 }}>Agenda, eventos, equipe, orçamento, fechamento e ajustes.</p>
              <button className="btn ghost block lg" onClick={() => setMode('atendimento')}>Atendimento do dia</button>
              <p className="muted" style={{ marginTop: 6 }}>Só o evento de hoje: fila, pagamentos, fichas e mesas. Entra com PIN.</p>
              <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '20px 0' }} />
              <Link className="btn ghost block" to="/cliente">Sou cliente · ver catálogo</Link>
              <Link className="btn ghost block" to="/fila">Abrir telão da fila</Link>
              {b.mode === 'local' && <p className="note">Modo demonstração: os dados ficam só neste navegador. Para o QR funcionar em outros celulares, conecte o Supabase (veja o README).</p>}
            </div>
          )}
          {mode === 'gestao' && (
            <form onSubmit={(e) => { e.preventDefault(); enterOwner(); }}>
              <h1 className="h1">Gestão do estúdio</h1>
              {b.mode === 'supabase' ? (
                sent ? (
                  <p className="note" role="status" style={{ marginTop: 16 }}>Enviamos um link para {email}. Abra o e-mail neste aparelho para entrar.</p>
                ) : (
                  <>
                    <Field label="Seu e-mail" error={err} hint="Você recebe um link para entrar, sem senha.">
                      {(p) => <input className="inp" {...p} type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />}
                    </Field>
                    <button className="btn block lg" style={{ marginTop: 18 }}>Receber link</button>
                  </>
                )
              ) : (
                <>
                  <p className="muted">No modo demonstração a gestão entra direto.</p>
                  <button className="btn block lg" style={{ marginTop: 18 }} autoFocus>Entrar na gestão</button>
                </>
              )}
              <button type="button" className="link" style={{ marginTop: 12 }} onClick={() => setMode('menu')}>← Voltar</button>
            </form>
          )}
          {mode === 'atendimento' && (
            <form onSubmit={(e) => { e.preventDefault(); enterDesk(); }}>
              <h1 className="h1">Atendimento do dia</h1>
              <Field label="PIN do atendimento" error={err} hint="A gestão vê e troca o PIN em Ajustes.">
                {(p) => <input className="inp" {...p} inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={8} value={pin}
                  onChange={(e) => setPinV(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 28, letterSpacing: '.3em' }} />}
              </Field>
              <button className="btn block lg" style={{ marginTop: 18 }}>Entrar</button>
              <button type="button" className="link" style={{ marginTop: 12 }} onClick={() => setMode('menu')}>← Voltar</button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
