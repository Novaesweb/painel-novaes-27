import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Store, WandSparkles } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type Props = {
  setupRequired?: boolean
  accessDenied?: boolean
  passwordRecovery?: boolean
  onSignOut?: () => void
  onRecoveryComplete?: () => Promise<boolean>
  email?: string
}

export function AuthScreen({ setupRequired = false, accessDenied = false, passwordRecovery = false, onSignOut, onRecoveryComplete, email }: Props) {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setLoading(true)
    if (!supabase) { setError('Configure a conexão do Supabase para habilitar o acesso.'); setLoading(false); return }
    const values = new FormData(event.currentTarget)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: String(values.get('email')), password: String(values.get('password')) })
      if (authError) {
        setError(authError.status === 400 || authError.status === 401
          ? 'E-mail ou senha incorretos. Verifique os dados e tente novamente.'
          : authError.status === 429
            ? 'Muitas tentativas. Aguarde um momento antes de tentar novamente.'
            : 'Não foi possível conectar ao serviço de autenticação. Tente novamente mais tarde.')
      }
    } catch {
      setError('Não foi possível conectar ao serviço de autenticação. Tente novamente mais tarde.')
    } finally {
      setLoading(false)
    }
  }

  async function recoverPassword() {
    if (loading) return
    setError(''); setNotice(''); setLoading(true)
    const emailField = document.querySelector<HTMLInputElement>('input[name="email"]')?.value.trim()
    if (!emailField) { setError('Informe seu e-mail para receber o link de recuperação.'); setLoading(false); return }
    if (!supabase) { setError('Configure o Supabase para habilitar a recuperação de senha.'); setLoading(false); return }
    try {
      const redirectTo = new URL('/?recuperacao=1', window.location.origin).toString()
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(emailField, { redirectTo })
      if (recoveryError) setError('Não foi possível enviar o link de recuperação agora.')
      else setNotice('Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.')
    } catch {
      setError('Não foi possível enviar o link de recuperação agora.')
    } finally {
      setLoading(false)
    }
  }

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setLoading(true)
    if (!supabase) { setError('A conexão de autenticação não está disponível. Solicite um novo link.'); setLoading(false); return }
    const values = new FormData(event.currentTarget)
    const password = String(values.get('new-password') ?? '')
    const confirmation = String(values.get('confirm-password') ?? '')
    if (password.length < 12) { setError('Use uma senha com pelo menos 12 caracteres.'); setLoading(false); return }
    if (password !== confirmation) { setError('As senhas não coincidem.'); setLoading(false); return }
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) { setError('Não foi possível redefinir a senha. Solicite um novo link.'); return }
      const completed = await onRecoveryComplete?.()
      if (completed === false) {
        setError('Senha atualizada, mas não foi possível encerrar a sessão. Feche esta janela e entre novamente.')
        return
      }
      setNotice('Senha atualizada. Entre novamente para continuar.')
    } catch {
      setError('Não foi possível redefinir a senha. Solicite um novo link.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="auth-shell">
    <section className="auth-story">
      <div className="story-glow glow-one" /><div className="story-glow glow-two" />
      <div className="brand"><img className="auth-brand-logo" src="/images/novaesweb-logo.jpeg" alt="Logo NovaesWeb" /><div><strong>Painel Master</strong><small>GESTÃO NOVAESWEB</small></div></div>
      <div className="story-content">
        <div className="eyebrow"><span className="live-dot" /> CENTRAL DE GESTÃO</div>
        <h1>Bem-vindo ao<br /><span>Painel Master</span></h1>
        <p className="story-lead">A gestão completa da sua plataforma, em um só lugar.</p>
        <ul className="feature-list">
          <li><span><Store size={17} /></span> Gerencie suas lojas</li>
          <li><span><ShieldCheck size={17} /></span> Controle de acessos</li>
          <li><span><WandSparkles size={17} /></span> Domínios e publicações</li>
          <li><span><Mail size={17} /></span> Suporte e notificações</li>
          <li><span><WandSparkles size={17} /></span> E muito mais...</li>
        </ul>
      </div>
      <div className="story-footer"><span className="footer-line" />Tecnologia que impulsiona o seu negócio!</div>
      <div className="orbital orbital-a" /><div className="orbital orbital-b" />
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <div className="brand auth-card-brand"><img className="auth-brand-logo" src="/images/novaesweb-logo.jpeg" alt="Logo NovaesWeb" /><div><strong>Painel Master</strong><small>GESTÃO NOVAESWEB</small></div></div>
        {setupRequired ? <>
          <div className="status-icon status-warn"><LockKeyhole size={22} /></div>
          <h2>Conexão pendente</h2>
          <p className="auth-description">A base do painel está pronta. Para conectar seu Supabase, vou precisar da URL do projeto e da chave pública (anon/publishable).</p>
          <div className="setup-note"><span className="live-dot amber" /> Nenhuma informação de demonstração está sendo exibida.</div>
        </> : passwordRecovery ? <>
          <p className="form-kicker">RECUPERAÇÃO SEGURA</p>
          <h2>Crie uma nova senha</h2>
          <p className="auth-description">Use uma senha forte, com pelo menos 12 caracteres. Este link é pessoal e temporário.</p>
          <form onSubmit={updatePassword} className="login-form">
            <label htmlFor="new-password">Nova senha</label>
            <div className="input-wrap"><LockKeyhole size={17} /><input id="new-password" name="new-password" type={passwordVisible ? 'text' : 'password'} placeholder="Mínimo de 12 caracteres" autoComplete="new-password" minLength={12} maxLength={256} required /><button type="button" className="icon-button" onClick={() => setPasswordVisible(!passwordVisible)} aria-label={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            <label htmlFor="confirm-password">Confirmar nova senha</label>
            <div className="input-wrap"><LockKeyhole size={17} /><input id="confirm-password" name="confirm-password" type={passwordVisible ? 'text' : 'password'} placeholder="Repita a nova senha" autoComplete="new-password" minLength={12} maxLength={256} required /></div>
            {error && <div className="form-message error-message" role="alert">{error}</div>}
            {notice && <div className="form-message success-message" role="status">{notice}</div>}
            <button className="primary-button" type="submit" disabled={loading}>{loading ? <><span className="button-spinner" /> Atualizando...</> : <>Atualizar senha <ArrowRight size={16} /></>}</button>
          </form>
        </> : accessDenied ? <>
          <div className="status-icon status-error"><ShieldCheck size={22} /></div>
          <h2>Acesso não autorizado</h2>
          <p className="auth-description">{email ? `${email} não possui um perfil autorizado para este painel.` : 'Este usuário não possui um perfil autorizado para este painel.'}</p>
          <button className="primary-button" onClick={onSignOut}>Sair da conta <ArrowRight size={16} /></button>
        </> : <>
          <p className="form-kicker">ACESSO RESTRITO</p>
          <h2>Acesse sua conta</h2>
          <p className="auth-description">Digite seu e-mail e senha para entrar no Painel Master.</p>
          {!isSupabaseConfigured && <div className="setup-note"><span className="live-dot amber" /> A autenticação será ativada após conectar o Supabase.</div>}
          <form onSubmit={signIn} className="login-form">
            <label htmlFor="email">E-mail</label>
            <div className="input-wrap"><Mail size={17} /><input id="email" name="email" type="email" placeholder="seu@email.com" autoComplete="email" required /></div>
            <div className="password-heading"><label htmlFor="password">Senha</label><button type="button" className="text-button" onClick={recoverPassword}>Esqueceu a senha?</button></div>
            <div className="input-wrap"><LockKeyhole size={17} /><input id="password" name="password" type={passwordVisible ? 'text' : 'password'} placeholder="Sua senha" autoComplete="current-password" required /><button type="button" className="icon-button" onClick={() => setPasswordVisible(!passwordVisible)} aria-label={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            {error && <div className="form-message error-message" role="alert">{error}</div>}
            {notice && <div className="form-message success-message" role="status">{notice}</div>}
            <button className="primary-button" type="submit" disabled={loading || !isSupabaseConfigured}>{loading ? <><span className="button-spinner" /> Entrando...</> : <>Entrar no painel <ArrowRight size={16} /></>}</button>
          </form>
          <div className="secure-note"><ShieldCheck size={15} /> Ambiente seguro e protegido</div>
        </>}
      </div>
      <span className="copyright">© 2026 NovaesWeb · Todos os direitos reservados</span>
    </section>
  </main>
}
