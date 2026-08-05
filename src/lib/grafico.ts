/**
 * Largura de barra proporcional à FATIA DO TOTAL, não ao maior valor.
 *
 * Normalizar pelo maior faz o primeiro colocado sempre ocupar 100%, e quando
 * todos os valores empatam (o caso comum enquanto a base é pequena) TODAS as
 * barras ficam cheias. Visualmente isso grita "tudo no máximo", que é o
 * contrário do que o dado diz: com 3 buscas divididas em 3 temas, cada tema
 * tem um terço, e é um terço que precisa aparecer na tela.
 *
 * O piso de 2% existe só para a barra continuar visível quando a fatia é
 * minúscula; ele distorce pouco e evita a barra sumir.
 */
export function larguraDaFatia(valor: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.max(2, (valor / total) * 100)}%`
}

/**
 * Abaixo disso um ranking não significa nada: qualquer ordem é ruído.
 * Serve para o painel avisar em vez de deixar a pessoa tirar conclusão de
 * uma amostra que não sustenta nenhuma.
 */
export const AMOSTRA_MINIMA = 10

export function amostraPequena(total: number): boolean {
  return total > 0 && total < AMOSTRA_MINIMA
}
