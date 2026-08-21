import { Mail, MousePointerClick, PhoneCall } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/lib/routes'
import { formatDateTime } from '@/lib/format'
import { larguraDaFatia } from '@/lib/grafico'
import { COMMERCIAL_ROLE_LABELS } from '@/types/database'
import type { CommercialRole } from '@/types/database'
import type { EmailInsights } from '@/types/search'

/**
 * O que a régua provoca, do lado de quem recebe.
 *
 * A régua era o único pedaço do funil sem número nosso: a lista de leads mostra
 * a etapa em que a pessoa está, e etapa é o que foi ENVIADO. Aqui entra o que
 * ela fez com o e-mail.
 *
 * A métrica é CLIQUE, não abertura, por dois motivos. A API do ActiveCampaign
 * não expõe abertura por campanha, só o total. E abertura virou número ruim
 * desde que o Apple Mail passou a abrir e-mail sozinho: clique continua sendo
 * ato de gente.
 *
 * O convite do parceiro aparece somado, com a origem ao lado, porque desde
 * 20/08 ele existe nas duas portas (dentro do plano e dentro do e-mail). Conta
 * PESSOAS e não cliques: a mesma pessoa nas duas portas é uma mão levantada,
 * não duas.
 */
export function EngajamentoEmail({ dados }: { dados: EmailInsights | null }) {
  const t = dados?.totais
  const receberam = t?.pessoas_que_receberam ?? 0
  const clicaram = t?.pessoas_que_clicaram ?? 0
  const convite = dados?.convite_parceiro
  const pendentes = dados?.clicou_e_nao_buscou ?? []

  if (receberam === 0) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="size-4.5 text-primary" aria-hidden="true" />
            Régua por e-mail
          </CardTitle>
          <CardDescription>
            Nenhum e-mail da régua registrado no período. Os eventos são sincronizados do
            ActiveCampaign de seis em seis horas.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="mb-8 grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="size-4.5 text-primary" aria-hidden="true" />
            Régua por e-mail
          </CardTitle>
          <CardDescription>
            Quantos receberam cada e-mail e quantos clicaram nele. A conta é de pessoas, e o
            sinal é clique: abertura o ActiveCampaign só dá em total, e o Apple Mail abre
            e-mail sozinho.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <p className="text-3xl font-semibold tabular-nums">
                {receberam === 0 ? 0 : Math.round((clicaram / receberam) * 100)}%
              </p>
              <p className="text-xs text-muted-foreground">clicaram em algum e-mail</p>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{clicaram}</strong> de{' '}
              <strong className="text-foreground">{receberam}</strong> pessoas que receberam,
              em <strong className="text-foreground">{t?.envios ?? 0}</strong> envio(s) e{' '}
              <strong className="text-foreground">{t?.cliques ?? 0}</strong> clique(s).
            </p>
          </div>

          <ul className="space-y-3">
            {(dados?.por_email ?? []).map((e) => (
              <li key={e.campaign_id}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  {/* o nome interno da campanha é "[CF] Gestor - E2 D2 - ..."; o
                      prefixo não informa nada em uma tela que só mostra CF */}
                  <span className="truncate">{e.campanha.replace(/^\[CF\]\s*/, '')}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {e.clicaram} de {e.receberam}
                    {e.taxa !== null ? ` (${e.taxa}%)` : ''}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: larguraDaFatia(e.clicaram, e.receberam) }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t pt-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <MousePointerClick className="size-4 text-primary" aria-hidden="true" />
              Convite do Viver de IA, pelas duas portas
            </p>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{convite?.pessoas_no_total ?? 0}</strong>{' '}
              pessoa(s) levantaram a mão:{' '}
              <strong className="text-foreground">{convite?.pelo_app ?? 0}</strong> pelo plano
              de ação e <strong className="text-foreground">{convite?.pelo_email ?? 0}</strong>{' '}
              pelo e-mail da régua. A mesma pessoa nas duas portas conta uma vez.
            </p>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            {dados?.leitores.com_open_registrado ?? 0} contato(s) com abertura registrada e{' '}
            {dados?.leitores.com_bounce ?? 0} com bounce. Esse número é da conta inteira do
            ActiveCampaign, não só das campanhas do ConcerFinder.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PhoneCall className="size-4.5 text-primary" aria-hidden="true" />
            Clicou no e-mail e não buscou
          </CardTitle>
          <CardDescription>
            A lista mais acionável do painel: a mensagem funcionou, a pessoa levantou a mão e o
            produto não recebeu a visita. Aqui cabe ligação, não outro e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguém nessa situação: quem clicou no e-mail acabou buscando.
            </p>
          ) : (
            <ul className="space-y-3">
              {pendentes.map((p) => (
                <li key={p.profile_id} className="border-b pb-3 last:border-0 last:pb-0">
                  <Link
                    to={ROUTES.adminLeadPerfil(p.profile_id)}
                    className="text-sm font-medium hover:underline"
                  >
                    {p.nome}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {COMMERCIAL_ROLE_LABELS[p.perfil as CommercialRole] ?? p.perfil} ·{' '}
                    {p.email} · clicou em {formatDateTime(p.ultimo_clique)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {(dados?.ultimos_cliques ?? []).length > 0 && (
            <div className="mt-6 border-t pt-4">
              <p className="mb-2 text-sm font-medium">Últimos cliques</p>
              <ul className="space-y-2">
                {(dados?.ultimos_cliques ?? []).map((c, i) => (
                  <li key={`${c.profile_id}-${c.em}-${i}`} className="text-sm">
                    <Link
                      to={ROUTES.adminLeadPerfil(c.profile_id)}
                      className="hover:underline"
                    >
                      {c.nome}
                    </Link>
                    <span className="text-muted-foreground">
                      {' '}
                      em {c.campanha.replace(/^\[CF\]\s*/, '')} ·{' '}
                      {c.link.includes('viverdeia') ? 'convite do parceiro' : 'link do ConcerFinder'}{' '}
                      · {formatDateTime(c.em)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
