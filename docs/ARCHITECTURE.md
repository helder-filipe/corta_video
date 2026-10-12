# Arquitetura

Aplicação estática HTML/CSS/JavaScript; scripts clássicos para edição e módulo Mediabunny para exportação. GitHub main aciona o deployment Vercel.

- app.js: estado e reprodução dos clips; timeline.js: cortes e régua.
- image-media.js: descodifica uma imagem num canvas e fornece um relógio de reprodução independente do áudio.
- export-engine.mjs: grelha temporal de fotogramas; imagens descodificadas uma vez por ficheiro; apenas vídeos e música fornecem áudio.
- subtitle-projects.js / project-file.mjs: projetos portáteis com originais e metadados.
- subtitles.js / subtitles-core.js: edição, SRT/VTT e desenho das legendas.
- formats.js / text-animations.js: enquadramento e títulos.

Os clips de imagem usam kind=image, duração inicial de 5 s e volume 0. O relógio suporta os controlos existentes, mas não é ligado a AudioContext. Recursos de imagem da exportação são libertados no finally.

## Reordenação na biblioteca

libraryAsset desenha cada entrada. reorderClip é a operação comum para a biblioteca e os botões Mover do painel; altera o array clips numa transação com histórico e reposiciona a pré-visualização no clip movido.
