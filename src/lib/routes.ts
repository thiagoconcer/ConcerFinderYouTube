/** Rotas do ConcerFinder, espelham docs/ESTRUTURA.md (seção 4) e docs/PAGINAS.md. */
export const ROUTES = {
  landing: '/',
  cadastro: '/cadastro',
  login: '/login',
  busca: '/busca',
  redefinirSenha: '/redefinir-senha',
  historico: '/busca/historico',
  video: (id = ':id') => `/video/${id}`,
  adminConteudo: '/admin/conteudo',
  adminDashboard: '/admin/dashboard',
  adminLeads: '/admin/leads',
  adminLeadPerfil: (id = ':id') => `/admin/leads/${id}`,
  /** Rota antiga; redireciona para o dashboard para não quebrar link salvo. */
  adminAudiencia: '/admin/audiencia',
} as const
