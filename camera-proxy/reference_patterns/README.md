# Reference Patterns (Anomalib - Tecido Bom)

Esta pasta armazena os dados gerados automaticamente durante a etapa de **Calibração (`POST /calibrate-pattern`)** quando o operador seleciona **Tecido Detalhado / Estampado (`estampado = true`)**.

## Estrutura gerada em `active_pattern/`

- `frames/`: Contém as fotos reais recortadas da Área de Análise (`ROI`) do **tecido bom (sem defeitos)** tiradas pela câmera antes do início da inspeção (`good_001.jpg`, `good_002.jpg`, ...).
- `memory_bank.npz`: Banco de memória Coreset (vetores de textura extraídos pelas camadas `layer1` + `layer2` da `ResNet18` combinados com CIE L\*a\*b\*) e estatísticas de distância da estampa normal.
- `metadata.json`: Metadados legíveis da calibração (data/hora, número de fotos salvas, tamanho do coreset, distância média e limiar adaptativo de anomalia).
