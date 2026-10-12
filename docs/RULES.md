# Regras

- Preservar as funcionalidades da versão atual do repositório.
- Não enviar ficheiros multimédia para serviços externos.
- Manter os projetos antigos legíveis.
- Tratar imagens como fontes sem áudio; nunca criar MediaElementAudioSourceNode para canvas.
- Usar a mesma composição e os mesmos tempos na pré-visualização e na exportação.
- Validar alterações funcionais; distinguir testes simulados de testes reais de codecs.
- Manter estes seis documentos atualizados.

## Reordenação na biblioteca

Biblioteca e timeline usam sempre o mesmo array clips. Recusar reordenações durante exportação ou outra operação ocupada. Não alterar tempos de origem nem duração ao reordenar.
