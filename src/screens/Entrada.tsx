import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field, Logo, useToast } from '../components/ui';
import { authErrorText } from '../lib/authErrors';
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
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Já conectada neste aparelho: entra direto, sem mandar e-mail de novo.
  const openGestao = async () => {
    if (b.mode === 'supabase' && (await b.ownerSignedIn().catch(() => false))) return nav('/painel');
    setMode('gestao');
  };
  const validEmail = () => {
    setErr('');
    setPwErr('');
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setErr('Escreva um e-mail válido.');
      return false;
    }
    return true;
  };
  const enterOwner = async () => {
    if (b.mode === 'local') {
      await b.ownerSignIn('');
      return nav('/painel');
    }
    if (!validEmail()) return;
    if (!pw) return setPwErr('Escreva a senha, ou use “Receber link por e-mail”.');
    setBusy(true);
    try {
      await b.ownerSignInPassword!(email, pw);
      nav('/painel');
    } catch (e) {
      setPwErr(authErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  const sendLink = async () => {
    if (!validEmail()) return;
    setBusy(true);
    try {
      await b.ownerSignIn(email);
      setSent(true);
    } catch (e) {
      const msg = authErrorText(e);
      setErr(msg);
      toast(msg);
    } finally {
      setBusy(false);
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
              <button className="btn block lg" onClick={openGestao}>Gestão do estúdio</button>
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
                  <>
                    <p className="note" role="status" style={{ marginTop: 16 }}>Enviamos um link para {email}. Abra o e-mail neste aparelho para entrar.</p>
                    <p className="muted">Depois de entrar, crie uma senha em Ajustes. Assim você não precisa de e-mail nas próximas vezes.</p>
                  </>
                ) : (
                  <>
                    <Field label="Seu e-mail" error={err}>
                      {(p) => <input className="inp" {...p} type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />}
                    </Field>
                    <Field label="Senha" error={pwErr} hint="Ainda não tem senha? Use “Receber link por e-mail” e crie a senha em Ajustes.">
                      {(p) => <input className="inp" {...p} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
                    </Field>
                    <button className="btn block lg" style={{ marginTop: 18 }} disabled={busy}>Entrar com senha</button>
                    <button type="button" className="btn ghost block" style={{ marginTop: 10 }} disabled={busy} onClick={sendLink}>Receber link por e-mail</button>
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
