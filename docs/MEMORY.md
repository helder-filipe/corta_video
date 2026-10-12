# Memória do projeto

2026-10-12: pedido de imagens na timeline. Implementadas como clips fixos com 5 s iniciais e máximo de 24 h de tempo de origem. Descodificação através de createImageBitmap; formatos dependem do navegador. PNG/JPEG/WebP são as opções recomendadas pela interface em caso de erro.

Manter transições, enquadramento e ajustes de áudio da versão GitHub, que contém funcionalidades ausentes de ZIPs anteriores. O utilizador autorizou publicação em main e deployment Vercel nesta conversa. Confirmar deployment pelo estado associado ao novo commit; não assumir sucesso de compilação.

Validação: testes de integração passaram para duração, relógio, pausa, divisão e reabertura. Exportação simulada passou para sequência mista com música e sequência apenas com imagens, a 30/60 fps em MP4/WebM. Não foi validada exportação real por codec nesta sessão.
