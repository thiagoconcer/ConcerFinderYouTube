/** Rotas do ConcerFinder — espelham docs/ESTRUTURA.md (seção 4) e docs/PAGINAS.md. */
export const ROUTES = {
  landing: '/',
  cadastro: '/cadastro',
  login: '/login',
  busca: '/busca',
  historico: '/busca/historico',
  video: (id = ':id') => `/video/${id}`,
  adminConteudo: '/admin/conteudo',
  adminAudiencia: '/admin/audiencia',
} as const
