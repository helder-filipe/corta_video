# Tarefas

- [x] Importação e miniaturas de imagens.
- [x] Relógio de reprodução e duração ajustável.
- [x] Exportação de imagens na grelha de fotogramas.
- [x] Persistência nos projetos.
- [x] Testar integração e exportação com fontes simuladas.
- [ ] Publicar e verificar estado do deployment.

Fora deste pedido: animação GIF, movimento Ken Burns e faixas de sobreposição de imagens.

## Reordenação na biblioteca

- [x] Reordenação por arrasto e botões.
- [x] Integração com Desfazer e persistência.
- [x] Testes de arrasto nos dois sentidos, ordem da timeline, seleção/cursor, bloqueio durante exportação e guardar/reabrir.
- [ ] Confirmar deployment da atualização no Vercel.

## Textos múltiplos e acompanhamento — 2026-10-13

Implementado e validado: vários títulos, seleção, recorte, remoção, Desfazer, persistência e migração do título antigo; seguimento horizontal com opção de desativação. Testes DOM/canvas/media simulados passaram. Publicação em produção ainda depende da confirmação do Vercel; ligação tem recusado acesso (403).

## Guardar como — 2026-10-13

Guardar como implementado. Testes simulados passaram: gravação/reabertura, cancelamento, acesso recusado, erro de escrita e alternativa sem seletor apenas após confirmação.
