# Memória do projeto

2026-10-12: pedido de imagens na timeline. Implementadas como clips fixos com 5 s iniciais e máximo de 24 h de tempo de origem. Descodificação através de createImageBitmap; formatos dependem do navegador. PNG/JPEG/WebP são as opções recomendadas pela interface em caso de erro.

Manter transições, enquadramento e ajustes de áudio da versão GitHub, que contém funcionalidades ausentes de ZIPs anteriores. O utilizador autorizou publicação em main e deployment Vercel nesta conversa. Confirmar deployment pelo estado associado ao novo commit; não assumir sucesso de compilação.

Validação: testes de integração passaram para duração, relógio, pausa, divisão e reabertura. Exportação simulada passou para sequência mista com música e sequência apenas com imagens, a 30/60 fps em MP4/WebM. Não foi validada exportação real por codec nesta sessão.

## Reordenação na biblioteca

2026-10-12: pedido de reordenação na biblioteca com efeito na timeline. Implementação reutiliza clips sem duplicar os ficheiros. Reordenação preserva transições associadas a cada clip e não desloca legendas/música globalmente.

## Textos múltiplos e acompanhamento — 2026-10-13

Pedido de 13/10/2026: acrescentar textos em vários pontos do vídeo e manter o cursor de reprodução visível na timeline. Corrigido também o wrapper das legendas, que descartava as definições explícitas da amostra de animação de texto. Testes de regressão incluem legendas, imagens, reordenação e projetos. Não foi feita validação visual num navegador real nem codificação real nesta alteração.

## Guardar como — 2026-10-13

13/10/2026: substituída a transferência automática do projeto pelo seletor de nome/pasta. Mantido o formato .corta e o conteúdo completo. Sem ensaio da janela nativa num navegador real. Deployment anterior ab12d57 confirmado pelo estado Vercel no GitHub.
