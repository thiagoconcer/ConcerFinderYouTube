/**
 * Traduz erros do Supabase Auth para mensagens amigáveis em pt-BR.
 * A UI nunca deve exibir a mensagem crua do provedor.
 */
export function friendlyAuthError(error: unknown): string {
  const raw =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? '')

  const message = raw.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Confira os dados e tente novamente.'
  }
  if (message.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado. Procure o link de confirmação na sua caixa de entrada.'
  }
  if (message.includes('user already registered') || message.includes('already been registered')) {
    return 'Este e-mail já tem cadastro. Faça login ou use o link mágico.'
  }
  if (message.includes('password should be at least')) {
    return 'A senha precisa ter no mínimo 6 caracteres.'
  }
  if (message.includes('unable to validate email') || message.includes('invalid email')) {
    return 'E-mail inválido. Verifique o endereço digitado.'
  }
  if (message.includes('for security purposes') || message.includes('rate limit') || message.includes('too many')) {
    return 'Muitas tentativas seguidas. Aguarde alguns segundos e tente de novo.'
  }
  if (message.includes('signups not allowed') || message.includes('signup is disabled')) {
    return 'Os cadastros estão desativados no momento. Fale com a equipe Concer.'
  }
  if (message.includes('failed to fetch') || message.includes('networkerror')) {
    return 'Não conseguimos falar com o servidor. Verifique sua conexão e tente novamente.'
  }

  return 'Não foi possível concluir a operação. Tente novamente em instantes.'
}
